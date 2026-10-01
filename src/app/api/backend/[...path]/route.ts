import { NextRequest, NextResponse } from "next/server";
import { obterTokenBackend } from "@/lib/authBackend";

type ParamsPromise = Promise<{ path: string[] }>;

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

  const resposta = await fetch(destino, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token.backendAccessToken}`,
      ...(temCorpo && contentType ? { "Content-Type": contentType } : {}),
    },
    body: corpo,
  });

  const corpoResposta = await resposta.text();
  return new NextResponse(corpoResposta || null, {
    status: resposta.status,
    headers: { "Content-Type": resposta.headers.get("Content-Type") ?? "application/json" },
  });
}

export {
  encaminhar as GET,
  encaminhar as POST,
  encaminhar as PUT,
  encaminhar as PATCH,
  encaminhar as DELETE,
};
