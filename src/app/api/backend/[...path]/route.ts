import { NextRequest, NextResponse } from "next/server";
import { obterTokenBackend } from "@/lib/authBackend";
import {
  codificarCookieSessao,
  MAX_AGE_COOKIE_SEGUNDOS,
  NOME_COOKIE_SESSAO,
  renovarToken,
  SECURE_COOKIE,
} from "@/lib/renovarTokenBackend";

type ParamsPromise = Promise<{ path: string[] }>;

async function encaminhar(request: NextRequest, { params }: { params: ParamsPromise }) {
  const token = await obterTokenBackend(request);

  if (!token?.backendAccessToken) {
    return NextResponse.json({ detail: "Não autenticado." }, { status: 401 });
  }

  const { path } = await params;
  // Next decodifica %2f só depois de já ter separado os segmentos pela barra
  // literal — um segmento tipo "..%2f..%2fadmin" chega aqui como "../../admin"
  // já decodificado, e o new URL() abaixo colapsaria isso pra fora do /api/.
  if (path.some((segmento) => segmento.includes("..") || segmento.includes("/"))) {
    return NextResponse.json({ detail: "Caminho inválido." }, { status: 400 });
  }

  const destino = new URL(`/api/${path.join("/")}/`, process.env.NEXT_PUBLIC_API_URL);
  destino.search = request.nextUrl.search;

  const temCorpo = !["GET", "HEAD"].includes(request.method);
  // Content-Type do próprio pedido, não fixo em "application/json" -- upload
  // de anexo (STC-168) manda multipart/form-data com boundary própria; forçar
  // application/json aqui quebrava o parsing multipart no Django. arrayBuffer()
  // (não .text()) pelo mesmo motivo: texto corrompe binário -- e não
  // request.body direto: mandar o ReadableStream pro fetch() aqui esvaziava o
  // corpo silenciosamente (testado via E2E: POST chegava no Django sem nenhum
  // campo, nem em JSON puro), então bufferiza mesmo com o custo de manter o
  // upload inteiro em memória (aceitável dado o limite de 35 MB do backend).
  // Bufferizado uma única vez -- reaproveitado também na 2ª tentativa após
  // renovar o token (abaixo), sem precisar reler o corpo da requisição.
  const contentType = request.headers.get("content-type");
  const corpo = temCorpo ? await request.arrayBuffer() : undefined;

  function chamarBackend(accessToken: string) {
    return fetch(destino, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(temCorpo && contentType ? { "Content-Type": contentType } : {}),
      },
      body: corpo,
    });
  }

  let resposta = await chamarBackend(token.backendAccessToken);
  let cookieRenovado: string | null = null;

  // Renovação silenciosa (STC-208): o access expirou (1h de vida), mas o
  // refresh (7 dias) ainda pode estar de pé -- tenta recuperar a sessão sem
  // derrubar o usuário. Fica aqui (não no callback jwt de src/auth.ts)
  // porque é o único ponto por onde passa 100% do tráfego pro backend --
  // ver nota no plano da STC-208 sobre o middleware excluir /api do matcher.
  if (resposta.status === 401 && token.backendRefreshToken) {
    const tokensNovos = await renovarToken(token.backendRefreshToken);
    if (tokensNovos) {
      // Retentativa já é o que importa pro usuário -- se der certo, tem que
      // voltar mesmo que a reescrita do cookie (abaixo) falhe por algum
      // motivo. Sem esse catch, uma exceção no encode() jogaria fora uma
      // resposta que já tinha dado certo, devolvendo 500 à toa.
      resposta = await chamarBackend(tokensNovos.access);
      try {
        cookieRenovado = await codificarCookieSessao(token, tokensNovos);
      } catch (erro) {
        console.error("Falha ao reescrever o cookie de sessão após renovar o token:", erro);
      }
    }
    // Se a renovação falhar (refresh também expirado/inválido/de conta
    // excluída), `resposta` continua sendo o 401 original -- mesmo
    // comportamento de hoje, cai no signOut do interceptor do Axios.
  }

  const corpoResposta = await resposta.text();
  const respostaFinal = new NextResponse(corpoResposta || null, {
    status: resposta.status,
    headers: { "Content-Type": resposta.headers.get("Content-Type") ?? "application/json" },
  });

  if (cookieRenovado) {
    respostaFinal.cookies.set(NOME_COOKIE_SESSAO, cookieRenovado, {
      httpOnly: true,
      secure: SECURE_COOKIE,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_COOKIE_SEGUNDOS,
    });
  }

  return respostaFinal;
}

export {
  encaminhar as GET,
  encaminhar as POST,
  encaminhar as PUT,
  encaminhar as PATCH,
  encaminhar as DELETE,
};
