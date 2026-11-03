import { NextRequest, NextResponse } from "next/server";
import { obterTokenBackend } from "@/lib/authBackend";
import { cabecalhosDoCliente } from "@/lib/cabecalhosDoCliente";

type ParamsPromise = Promise<{ path: string[] }>;

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Só encaminha: não renova o token. Um 401 do backend volta como 401 pro
// navegador, que renova pela rota /api/sessao/renovar a partir do cookie
// ATUAL e repete a requisição (ver src/lib/renovarSessao.ts). Renovar aqui,
// com o refresh do cookie que veio NESTA requisição, não funciona numa
// rajada: as requisições que chegam logo depois da primeira renovação ainda
// carregam a cópia antiga do cookie e renovariam com um refresh que a
// rotação acabou de revogar.
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
  const contentType = request.headers.get("content-type");
  const corpo = temCorpo ? await request.arrayBuffer() : undefined;
  // "Ver como" (STC-790): o id da sessão passa adiante; o backend valida a
  // sessão a cada requisição (é do Admin deste token, não venceu).
  const verComo = request.headers.get("x-ver-como");

  const inicio = performance.now();
  const resposta = await fetch(destino, {
    method: request.method,
    headers: {
      // IP e navegador de quem está usando o Atlas, para a trilha de
      // auditoria do backend (src/lib/cabecalhosDoCliente.ts).
      ...cabecalhosDoCliente(request.headers),
      Authorization: `Bearer ${token.backendAccessToken}`,
      ...(verComo && FORMATO_UUID.test(verComo) ? { "X-Ver-Como": verComo } : {}),
      ...(temCorpo && contentType ? { "Content-Type": contentType } : {}),
    },
    body: corpo,
  });

  // arrayBuffer() (não .text()): a planilha da Legalização (STC-963) é
  // binária, e texto a corromperia. JSON passa igual, byte a byte.
  const corpoResposta = await resposta.arrayBuffer();
  // Tempo da chamada ao backend, do início do fetch ao fim da leitura (rede
  // Vercel-Render, Django e banco). O DevTools mostra em Timing > Server
  // Timing, separado da espera total do navegador (STC-933).
  const duracao = performance.now() - inicio;
  const cabecalhos: Record<string, string> = {
    "Content-Type": resposta.headers.get("Content-Type") ?? "application/json",
    "Server-Timing": `backend;dur=${duracao.toFixed(1)}`,
  };
  // Nome do arquivo de um download (STC-963).
  const disposicao = resposta.headers.get("Content-Disposition");
  if (disposicao) cabecalhos["Content-Disposition"] = disposicao;
  return new NextResponse(corpoResposta.byteLength ? corpoResposta : null, {
    status: resposta.status,
    headers: cabecalhos,
  });
}

export {
  encaminhar as GET,
  encaminhar as POST,
  encaminhar as PUT,
  encaminhar as PATCH,
  encaminhar as DELETE,
};
