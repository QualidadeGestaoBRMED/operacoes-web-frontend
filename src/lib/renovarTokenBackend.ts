import { encode } from "next-auth/jwt";

// Server-side: troca o refresh do backend por um par novo e reescreve o
// cookie de sessão. Usado só pela rota /api/sessao/renovar -- quem decide
// QUANDO renovar é o navegador (src/lib/renovarSessao.ts), que chama essa
// rota com o cookie atual.

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

export type TokensBackend = { access: string; refresh: string };

// "em_andamento" é o 503 do /api/auth/refresh/: outra renovação do mesmo
// refresh ainda não terminou (janela de tolerância do backend). Não é sessão
// inválida -- quem chamou tenta de novo depois do Retry-After.
export type ResultadoRenovacao =
  | { tipo: "renovado"; tokens: TokensBackend }
  | { tipo: "em_andamento"; retryAfterSegundos: number }
  | { tipo: "recusado" };

// Dedupe de renovação concorrente dentro da mesma instância do processo Node:
// duas chamadas com o mesmo refresh ao mesmo tempo reaproveitam a mesma ida
// ao backend. A proteção de verdade contra corrida (várias instâncias da
// Vercel, várias abas) é a janela de tolerância do backend, que devolve o
// mesmo par para o mesmo refresh por alguns segundos.
const renovacoesEmAndamento = new Map<string, Promise<ResultadoRenovacao>>();

function segundosDoRetryAfter(resposta: Response): number {
  const valor = Number(resposta.headers.get("Retry-After"));
  return Number.isFinite(valor) && valor > 0 ? valor : 1;
}

export async function renovarToken(refreshToken: string): Promise<ResultadoRenovacao> {
  const emAndamento = renovacoesEmAndamento.get(refreshToken);
  if (emAndamento) return emAndamento;

  const promessa = (async (): Promise<ResultadoRenovacao> => {
    try {
      const resposta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (resposta.ok) {
        return { tipo: "renovado", tokens: (await resposta.json()) as TokensBackend };
      }
      if (resposta.status === 503) {
        return { tipo: "em_andamento", retryAfterSegundos: segundosDoRetryAfter(resposta) };
      }
      return { tipo: "recusado" };
    } catch {
      return { tipo: "recusado" };
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
// auth.ts grava no callback jwt, só que fora do fluxo normal do NextAuth.
export async function codificarCookieSessao(
  token: Record<string, unknown>,
  tokensNovos: TokensBackend,
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
