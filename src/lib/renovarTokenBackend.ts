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
// "recusado" é só o 401 do backend: refresh inválido, expirado ou revogado.
// "indisponivel" é qualquer outra falha: rede, throttle (429), erro do
// backend ou um 4xx que não veio dele (ex.: 403 de proxy/WAF na frente) --
// a sessão pode estar boa, então não é motivo pra deslogar. O 400 do
// /refresh/ só sai sem o campo "refresh" no corpo, que daqui sempre vai.
export type ResultadoRenovacao =
  | { tipo: "renovado"; tokens: TokensBackend }
  | { tipo: "em_andamento"; retryAfterSegundos: number }
  | { tipo: "recusado" }
  | { tipo: "indisponivel" };


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
      if (resposta.status === 401) return { tipo: "recusado" };
      return { tipo: "indisponivel" };
    } catch {
      return { tipo: "indisponivel" };
    }
  })();

  renovacoesEmAndamento.set(refreshToken, promessa);
  try {
    return await promessa;
  } finally {
    renovacoesEmAndamento.delete(refreshToken);
  }
}

// Margem antes do vencimento: renovar um pouco antes evita mandar ao backend
// um access que vence no meio do caminho.
const MARGEM_EXPIRACAO_SEGUNDOS = 10;
// No callback jwt, quanto esperar um 503 (renovação em andamento) antes de
// tentar de novo -- curto, porque o callback roda dentro do /session e do
// middleware, segurando a resposta.
const ESPERA_MAXIMA_EM_ANDAMENTO_MS = 2_000;

/** `exp` (em ms) do access do backend, ou null se ausente/ilegível. Só lê o
 * payload, sem validar assinatura -- quem valida é o backend. atob, não
 * Buffer: roda também no middleware (runtime Edge). */
function expiracaoDoAccessMs(access: unknown): number | null {
  if (typeof access !== "string") return null;
  try {
    const base64 = access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** O access já venceu (ou vence em segundos)? false para token ausente ou
 * ilegível: o callback jwt não tem como renovar o que não sabe ler. */
export function accessExpirado(access: unknown, agora = Date.now()): boolean {
  const exp = expiracaoDoAccessMs(access);
  return exp !== null && exp <= agora + MARGEM_EXPIRACAO_SEGUNDOS * 1000;
}

/** O access ainda vale por mais de `segundos`? false para token ausente ou
 * ilegível -- na dúvida, quem pergunta renova. */
export function accessValidoPorMaisDe(
  access: unknown,
  segundos: number,
  agora = Date.now(),
): boolean {
  const exp = expiracaoDoAccessMs(access);
  return exp !== null && exp > agora + segundos * 1000;
}

type TokenDaSessao = {
  backendAccessToken?: unknown;
  backendRefreshToken?: unknown;
  backendRefreshRecusado?: boolean;
};

/**
 * Usado pelo callback jwt do NextAuth (src/auth.ts), que roda no
 * /api/auth/session e no middleware: os dois regravam o cookie de sessão
 * inteiro a partir da cópia que veio na requisição. Sem isto, uma resposta
 * do /session gerada com o cookie de ANTES de uma renovação, chegando
 * depois dela, trazia de volta o refresh já rotacionado -- e, passada a
 * janela de tolerância do backend, a próxima renovação deslogava a pessoa.
 * Com isto, o /session e o middleware também renovam um access vencido, e
 * todos os escritores do cookie convergem pro mesmo par: um /session com o
 * refresh antigo está em andamento justo no momento da renovação, então cai
 * na janela do backend e recebe o mesmo par.
 *
 * Nunca lança: se a renovação não der certo, devolve o token como veio, e o
 * fluxo do navegador (src/lib/renovarSessao.ts) cuida do 401. Refresh
 * recusado pelo backend fica marcado no token: sem isso, cada /session e cada
 * navegação até o signOut reenviaria o mesmo refresh morto, gastando o
 * throttle do /refresh/ -- e um 429 na renovação do navegador conta como
 * indisponível, segurando a pessoa numa sessão morta em vez de ir pro login.
 */
export async function tokenComAccessValido<T extends TokenDaSessao>(token: T): Promise<T> {
  if (
    typeof token.backendRefreshToken !== "string" ||
    token.backendRefreshRecusado ||
    !accessExpirado(token.backendAccessToken)
  ) {
    return token;
  }
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const resultado = await renovarToken(token.backendRefreshToken);
    if (resultado.tipo === "renovado") {
      return {
        ...token,
        backendAccessToken: resultado.tokens.access,
        backendRefreshToken: resultado.tokens.refresh,
      };
    }
    if (resultado.tipo === "recusado") return { ...token, backendRefreshRecusado: true };
    if (resultado.tipo !== "em_andamento" || tentativa === 2) return token;
    await new Promise((resolver) =>
      setTimeout(
        resolver,
        Math.min(resultado.retryAfterSegundos * 1000, ESPERA_MAXIMA_EM_ANDAMENTO_MS),
      ),
    );
  }
  return token;
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
