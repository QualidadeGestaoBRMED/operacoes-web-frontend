import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

type ParamsPromise = Promise<{ path: string[] }>;

async function encaminhar(request: NextRequest, { params }: { params: ParamsPromise }) {
  const token = await getToken({ req: request });

  if (!token?.backendAccessToken) {
    return NextResponse.json({ detail: "Não autenticado." }, { status: 401 });
  }

  const { path } = await params;
  const destino = new URL(`/api/${path.join("/")}/`, process.env.NEXT_PUBLIC_API_URL);
  destino.search = request.nextUrl.search;

  const temCorpo = !["GET", "HEAD"].includes(request.method);

  const resposta = await fetch(destino, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token.backendAccessToken}`,
      ...(temCorpo ? { "Content-Type": "application/json" } : {}),
    },
    body: temCorpo ? await request.text() : undefined,
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
