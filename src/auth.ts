import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";

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
    authorized({ auth: sessao, request }) {
      const emLogin = request.nextUrl.pathname.startsWith("/login");
      if (emLogin) return true;

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
      return !!sessao?.user?.usuarioId;
    },
  },
});
