import { encode } from "next-auth/jwt";

// Extraído de src/app/api/backend/[...path]/route.ts (achado em code review,
// STC-416): o proxy de mídia (src/app/api/media/) precisa da MESMA renovação
// silenciosa de token (STC-208) -- sem isto, um access token expirado no meio
// de uma sessão longa quebrava só o preview de PDF (502 sem recuperação),
// enquanto o resto do app se recuperava sozinho via este mesmo mecanismo.

export const SECURE_COOKIE = process.env.NODE_ENV === "production";
// encode() não autodetecta isso sozinho -- mesmo achado documentado em
// obterTokenBackend() (authBackend.ts).
export const NOME_COOKIE_SESSAO = SECURE_COOKIE
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";
const SEGREDO = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
// Mesma vida do refresh do backend (SIMPLE_JWT.REFRESH_TOKEN_LIFETIME) --
// não faz sentido o cookie sobreviver além do que o refresh nele permite.
export const MAX_AGE_COOKIE_SEGUNDOS = 60 * 60 * 24 * 7;

// Dedupe de renovação concorrente (STC-208): duas requisições vendo o mesmo
// access expirado não podem cada uma chamar /refresh/ com o mesmo refresh --
// a rotação do backend blacklista o antigo, a 2ª perderia a corrida e
// tomaria um 401 indevido em vez de reaproveitar o resultado da 1ª. Só
// protege dentro da mesma instância do processo Node (não é lock
// distribuído entre instâncias serverless) -- suficiente pra escala atual.
// Compartilhado entre os dois proxies (backend genérico e mídia): o mesmo
// refresh token pode chegar de qualquer um dos dois quase ao mesmo tempo
// (ex.: o poll de 60s da lista e um clique no preview).
const renovacoesEmAndamento = new Map<
  string,
  Promise<{ access: string; refresh: string } | null>
>();

export async function renovarToken(
  refreshToken: string,
): Promise<{ access: string; refresh: string } | null> {
  const emAndamento = renovacoesEmAndamento.get(refreshToken);
  if (emAndamento) return emAndamento;

  const promessa = (async () => {
    try {
      const resposta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!resposta.ok) return null;
      return (await resposta.json()) as { access: string; refresh: string };
    } catch {
      return null;
    }
  })();

  renovacoesEmAndamento.set(refreshToken, promessa);
  try {
    return await promessa;
  } finally {
    renovacoesEmAndamento.delete(refreshToken);
  }
}

// Reescreve o cookie de sessão com os tokens novos -- mesmo formato que
// auth.ts grava no callback jwt, só que fora do fluxo normal do NextAuth
// (aqui é uma renovação silenciosa disparada por um 401 no meio de um
// proxy, não um refresh de sessão do NextAuth em si).
export async function codificarCookieSessao(
  token: Record<string, unknown>,
  tokensNovos: { access: string; refresh: string },
) {
  return encode({
    token: {
      ...token,
      backendAccessToken: tokensNovos.access,
      backendRefreshToken: tokensNovos.refresh,
    },
    // encode() (ao contrário de getToken(), usado em authBackend.ts) não
    // aceita `secret` opcional no tipo -- mesma env var, só o "!" muda.
    secret: SEGREDO!,
    salt: NOME_COOKIE_SESSAO,
    maxAge: MAX_AGE_COOKIE_SEGUNDOS,
  });
}
