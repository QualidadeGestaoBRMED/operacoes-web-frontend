import { NextRequest, NextResponse } from "next/server";
import { obterTokenBackend } from "@/lib/authBackend";
import {
  codificarCookieSessao,
  MAX_AGE_COOKIE_SEGUNDOS,
  NOME_COOKIE_SESSAO,
  renovarToken,
  SECURE_COOKIE,
} from "@/lib/renovarTokenBackend";

// STC-416 (Biblioteca de Documentos): proxy same-origin só de leitura, pra
// baixar o PDF de uma evidência vigente e servir de volta pro navegador
// como bytes binários (não como texto -- diferente de
// src/app/api/backend/[...path]/route.ts, que só lida com JSON).
//
// Por que existe (achado testando a pré-visualização embutida):
// 1. CSP (connect-src 'self', src/lib/csp.ts) bloqueia qualquer fetch()
//    do navegador direto pro backend ou pro R2 -- todo fetch do cliente
//    precisa ficar same-origin.
// 2. Em dev, o backend manda X-Frame-Options: DENY em toda resposta
//    (nenhum <iframe src> direto rendereriza, nem same-origin).
// 3. Em produção, toda URL assinada do R2 já vem com Content-Disposition:
//    attachment forçado (achado de segurança documentado em
//    backend/core/settings/base.py) -- o navegador sempre tentaria
//    baixar em vez de renderizar, mesmo resolvendo (1) e (2).
// A única forma de contornar os três de uma vez é buscar os bytes aqui
// (server-side, sem CSP nem X-Frame-Options) e o cliente montar sua
// própria Blob URL a partir da resposta -- ver useEffect em
// BibliotecaDocumentos.tsx.
//
// "documento" (não uma URL) no parâmetro: nunca aceita uma URL vinda do
// cliente pra buscar (isso seria SSRF -- qualquer sessão autenticada
// poderia usar este proxy pra buscar QUALQUER endereço). Em vez disso,
// rebusca a evidência vigente direto do backend, pelo mesmo endpoint
// aninhado (documentos/{id}/evidencias/) que get_object() já escopa pela
// visibilidade RBAC do usuário -- um id de documento fora do que o usuário
// pode ver já vem 404 de lá, sem nenhuma lógica de autorização duplicada
// aqui.
export async function GET(request: NextRequest) {
  const token = await obterTokenBackend(request);
  if (!token?.backendAccessToken) {
    return NextResponse.json({ detail: "Não autenticado." }, { status: 401 });
  }

  const documentoIdBruto = request.nextUrl.searchParams.get("documento");
  const documentoId = documentoIdBruto ? Number(documentoIdBruto) : NaN;
  if (!Number.isInteger(documentoId) || documentoId <= 0) {
    return NextResponse.json(
      { detail: "Parâmetro 'documento' ausente ou inválido." },
      { status: 400 },
    );
  }

  function buscarEvidencias(accessToken: string) {
    return fetch(
      new URL(
        `/api/modulos/legalizacao/documentos/${documentoId}/evidencias/`,
        process.env.NEXT_PUBLIC_API_URL,
      ),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  let respostaEvidencias = await buscarEvidencias(token.backendAccessToken);
  let cookieRenovado: string | null = null;

  // Renovação silenciosa (STC-208, achado em code review: este proxy fazia
  // sua própria chamada ao backend sem passar pela mesma lógica que
  // /api/backend/[...path]/route.ts já tem -- um access token expirado no
  // meio de uma sessão longa quebrava só o preview, com um 502 sem
  // recuperação, enquanto o resto do app se recuperava sozinho). Mesmo
  // padrão daquele proxy: tenta recuperar a sessão com o refresh token antes
  // de desistir.
  if (respostaEvidencias.status === 401 && token.backendRefreshToken) {
    const tokensNovos = await renovarToken(token.backendRefreshToken);
    if (tokensNovos) {
      respostaEvidencias = await buscarEvidencias(tokensNovos.access);
      try {
        cookieRenovado = await codificarCookieSessao(token, tokensNovos);
      } catch (erro) {
        console.error("Falha ao reescrever o cookie de sessão após renovar o token:", erro);
      }
    }
    // Se a renovação falhar, respostaEvidencias continua sendo o 401
    // original -- cai no branch de erro abaixo, mesmo comportamento de hoje.
  }

  // Cookie renovado precisa ir em toda resposta a partir daqui, não só na de
  // sucesso -- senão a próxima requisição (ex.: o próximo poll de 60s) ainda
  // vê o cookie velho e passa pelo mesmo 401 de novo.
  function comCookieRenovado(resposta: NextResponse) {
    if (cookieRenovado) {
      resposta.cookies.set(NOME_COOKIE_SESSAO, cookieRenovado, {
        httpOnly: true,
        secure: SECURE_COOKIE,
        sameSite: "lax",
        path: "/",
        maxAge: MAX_AGE_COOKIE_SEGUNDOS,
      });
    }
    return resposta;
  }

  if (!respostaEvidencias.ok) {
    return comCookieRenovado(
      NextResponse.json(
        { detail: "Documento não encontrado." },
        { status: respostaEvidencias.status === 404 ? 404 : 502 },
      ),
    );
  }

  const evidencias = (await respostaEvidencias.json()) as { arquivo: string; vigente: boolean }[];
  const vigente = evidencias.find((evidencia) => evidencia.vigente);
  if (!vigente) {
    return comCookieRenovado(
      NextResponse.json(
        { detail: "Nenhuma evidência vigente para este documento." },
        { status: 404 },
      ),
    );
  }

  // "arquivo" já vem absoluto em produção (URL assinada do R2); em dev é
  // relativo ("/media/..."), resolvido contra o próprio backend -- mesma
  // regra de urlAbsolutaDaEvidencia() (lib/legalizacao.ts), reimplementada
  // aqui porque este arquivo roda no servidor (Next.js API route), não no
  // componente React que importa aquele helper.
  const urlArquivo = /^https?:\/\//.test(vigente.arquivo)
    ? vigente.arquivo
    : new URL(vigente.arquivo, process.env.NEXT_PUBLIC_API_URL).toString();

  const respostaArquivo = await fetch(urlArquivo);
  if (!respostaArquivo.ok) {
    return comCookieRenovado(
      NextResponse.json({ detail: "Não foi possível baixar o arquivo." }, { status: 502 }),
    );
  }

  // arrayBuffer() (não .text(), como o proxy de JSON) -- texto corrompe
  // conteúdo binário.
  const bytes = await respostaArquivo.arrayBuffer();
  return comCookieRenovado(
    new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": respostaArquivo.headers.get("Content-Type") ?? "application/pdf",
      },
    }),
  );
}
