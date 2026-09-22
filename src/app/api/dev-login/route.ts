import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Usuario } from "@/types";

const SETE_DIAS_EM_SEGUNDOS = 60 * 60 * 24 * 7;

// STC-506: atalho de login só pra desenvolvimento local, sem passar pelo
// Google OAuth real -- existe porque testar pelo celular via IP da rede
// local esbarra no Google Console recusando IP cru como redirect URI, e
// testar via navegador automatizado não tem sessão Google real disponível.
// Mesma receita de e2e/auth.setup.ts (forja o cookie de sessão do NextAuth
// com encode()/NEXTAUTH_SECRET), só que a suíte roda offline via
// management command e esta rota busca os tokens de um usuário já
// existente no backend de dev de verdade, em tempo real.
export async function GET(request: NextRequest) {
  // Dupla trava, de propósito: NODE_ENV aqui (a rota nem existe fora de
  // dev) e settings.DEBUG no backend (DevLoginView, accounts/views.py) --
  // mesmo se algum dia esta rota vazasse pra um build de produção por
  // engano, o backend ainda recusaria.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  // Achado em análise de falhas críticas (STC-506): GET com efeito colateral
  // (loga sozinho ao ser visitado) pode ser disparado às cegas por uma
  // página de terceiro (<img src="http://localhost:3000/api/dev-login?...">
  // já basta) enquanto o `next dev` estiver rodando -- o navegador dispara
  // o GET automaticamente, sem o desenvolvedor perceber. Sec-Fetch-Site é
  // mandado sozinho por todo navegador moderno (Fetch Metadata) e distingue
  // exatamente esse caso ("cross-site") de navegação direta (digitar a URL,
  // favorito = "none") ou um link dentro do próprio app ("same-origin") --
  // ausente (curl, navegador antigo) não bloqueia, só o valor explícito
  // "cross-site" bloqueia.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json(
      { error: "Bloqueado: requisição de origem diferente (sec-fetch-site: cross-site)." },
      { status: 403 },
    );
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "Informe ?email=... de um usuário já existente no banco de dev." },
      { status: 400 },
    );
  }

  const respostaBackend = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/auth/dev-login/?email=${encodeURIComponent(email)}`,
  );
  if (!respostaBackend.ok) {
    const corpo = await respostaBackend.text();
    return NextResponse.json(
      { error: `Backend recusou (${respostaBackend.status}): ${corpo}` },
      { status: respostaBackend.status },
    );
  }

  const { access, refresh, user } = (await respostaBackend.json()) as {
    access: string;
    refresh: string;
    user: Usuario;
  };

  const segredo = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!segredo) {
    return NextResponse.json(
      { error: "AUTH_SECRET/NEXTAUTH_SECRET não configurado neste ambiente." },
      { status: 500 },
    );
  }

  const token = await encode({
    token: {
      sub: String(user.id),
      email: user.email,
      name: `${user.first_name} ${user.last_name}`.trim(),
      backendAccessToken: access,
      backendRefreshToken: refresh,
      backendUser: user,
    },
    secret: segredo,
    salt: "authjs.session-token",
    maxAge: SETE_DIAS_EM_SEGUNDOS,
  });

  // Sem domain explícito (diferente de auth.setup.ts, que precisa por
  // rodar fora de uma resposta HTTP real): o navegador escopa um cookie
  // sem Domain pro host exato da resposta, funcionando certo tanto em
  // localhost:3000 quanto em 192.168.x.x:3000 sem configuração nenhuma.
  // Sem o prefixo __Secure- também de propósito: `next dev` roda em HTTP
  // puro (nunca HTTPS), e o navegador rejeita silenciosamente um cookie
  // __Secure- fora de HTTPS -- middleware/auth() já auto-detecta HTTP e
  // espera o nome sem prefixo (ver comentário em e2e/auth.setup.ts).
  const resposta = NextResponse.redirect(new URL("/", request.url));
  resposta.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SETE_DIAS_EM_SEGUNDOS,
  });
  return resposta;
}
