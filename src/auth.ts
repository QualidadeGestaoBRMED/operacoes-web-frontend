import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { construirCsp, gerarNonce } from "@/lib/csp";
import type { Usuario } from "@/types";

async function trocarTokenComBackend(idToken: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!response.ok) {
    throw new Error("Falha ao autenticar com o backend.");
  }

  return response.json() as Promise<{ access: string; refresh: string; user: Usuario }>;
}

async function invalidarRefreshNoBackend(refresh: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
  } catch (erro) {
    // Best-effort: se o backend estiver fora do ar nesse instante, o cookie
    // local já foi limpo de qualquer forma -- o usuário não fica preso. O
    // refresh só continua válido até expirar sozinho (7 dias) nesse caso raro.
    console.error("Falha ao invalidar o refresh token no logout:", erro);
  }
}

// Extraído do objeto de config da NextAuth pra dar pra testar em isolamento
// (Vitest chama esta função direto, sem precisar montar toda a
// infraestrutura de middleware/servidor). Achado no code review do Tech
// Lead (STC-239): script-src usava 'unsafe-inline' -- migrado pra nonce,
// gerado aqui (por requisição). O "allow" de antes (return true) virou
// "monta uma NextResponse.next() com o CSP nonce'd e devolve ela" -- a
// árvore de decisão de autorização em si (quem passa, quem é bloqueado,
// quem é redirecionado) não mudou em nada, só o que a rota permitida
// carrega de volta.
export function autorizado({
  auth: sessao,
  request,
}: {
  auth: Session | null;
  request: NextRequest;
}) {
  const emLogin = request.nextUrl.pathname.startsWith("/login");

  if (!emLogin) {
    if (sessao?.error === "BackendAuthError") {
      const destino = new URL("/login", request.nextUrl.origin);
      destino.searchParams.set("error", "BackendAuthError");
      const resposta = NextResponse.redirect(destino);
      // Limpa a sessão quebrada (autenticada no Google, mas sem confirmação
      // do backend) pra próxima tentativa de login começar do zero.
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.endsWith("authjs.session-token")) {
          resposta.cookies.delete(cookie.name);
        }
      }
      return resposta;
    }

    // usuarioId só existe quando o backend confirmou o login (token.backendUser).
    // backendAccessToken não fica na sessão do cliente — ver route.ts do proxy.
    if (!sessao?.user?.usuarioId) return false;
  }

  const nonce = gerarNonce();
  const csp = construirCsp(nonce);
  // Nos headers da REQUISIÇÃO (não só da resposta): é assim que o Next.js
  // detecta e aplica o mesmo nonce sozinho nos scripts inline que ele
  // injeta na hidratação -- ver comentário em src/lib/csp.ts. x-nonce à
  // parte, cru: app/layout.tsx lê isso via headers() só pelo efeito
  // colateral de tirar as páginas da renderização estática (obrigatório
  // pra um nonce POR REQUISIÇÃO valer de algo -- uma página pré-renderizada
  // em build time nunca teria o nonce certo no HTML gerado).
  const cabecalhosDaRequisicao = new Headers(request.headers);
  cabecalhosDaRequisicao.set("x-nonce", nonce);
  cabecalhosDaRequisicao.set("Content-Security-Policy", csp);
  const resposta = NextResponse.next({ request: { headers: cabecalhosDaRequisicao } });
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email_verified) return false;
      if (!profile.email?.endsWith("@grupobrmed.com.br")) return false;
      // hd só vem preenchido em contas Workspace; quando presente, precisa bater
      // com o domínio — o backend reforça a mesma checagem como fonte da verdade.
      if (profile.hd && profile.hd !== "grupobrmed.com.br") return false;
      return true;
    },
    async jwt({ token, account }) {
      if (account?.id_token) {
        try {
          const dados = await trocarTokenComBackend(account.id_token);
          token.backendAccessToken = dados.access;
          // Renovação de verdade acontece no proxy BFF (route.ts, STC-208) --
          // é o único ponto por onde 100% das chamadas ao backend passam.
          // Este callback jwt não roda pra requisições de /api/backend/...
          // (getToken() ali é standalone, não dispara callback; e o
          // middleware, que dispara, exclui /api do matcher). Só guarda o
          // refresh aqui pra ele existir no cookie.
          token.backendRefreshToken = dados.refresh;
          token.backendUser = dados.user;
          delete token.error;
        } catch (erro) {
          // Sem isso, timeout/conexão recusada/500 do backend/corpo inválido
          // caem todos no mesmo "BackendAuthError" genérico sem nenhum
          // rastro -- impossível diferenciar uma falha transitória de um
          // problema real sem ver o motivo real no terminal do dev server.
          console.error("Falha ao trocar token com o backend:", erro);
          token.error = "BackendAuthError";
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.error = token.error;
      if (token.backendUser) {
        const { id: usuarioId, ...dadosUsuario } = token.backendUser;
        session.user = { ...session.user, ...dadosUsuario, usuarioId };
      }
      return session;
    },
    authorized: autorizado,
  },
  events: {
    // Roda server-side toda vez que signOut() é chamado -- cobre tanto o
    // automático (interceptor de 401 em src/lib/api.ts) quanto o botão
    // manual "Sair" (STC-192), sem precisar tocar em nenhum dos dois. Sem
    // isso, o refresh token continuava válido no backend por até 7 dias
    // depois do usuário já ter "saído" da conta no navegador.
    async signOut(mensagem) {
      if ("token" in mensagem && mensagem.token?.backendRefreshToken) {
        await invalidarRefreshNoBackend(mensagem.token.backendRefreshToken);
      }
    },
  },
});
