import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

type ParamsPromise = Promise<{ path: string[] }>;

async function encaminhar(request: NextRequest, { params }: { params: ParamsPromise }) {
  // getToken() é o helper standalone de next-auth/jwt -- diferente do
  // auth()/handlers exportados por src/auth.ts, ele não detecta o secret
  // sozinho a partir do NextAuth({...}) principal. Precisa receber
  // explicitamente, senão lança MissingSecret (nunca tinha sido exercitado
  // de ponta a ponta localmente até agora).
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

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

  const resposta = await fetch(destino, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token.backendAccessToken}`,
      ...(temCorpo && contentType ? { "Content-Type": contentType } : {}),
    },
    body: temCorpo ? await request.arrayBuffer() : undefined,
  });

  const corpo = await resposta.text();
  return new NextResponse(corpo || null, {
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
