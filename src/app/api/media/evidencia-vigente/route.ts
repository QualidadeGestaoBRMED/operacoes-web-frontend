import { NextRequest, NextResponse } from "next/server";
import { obterTokenBackend } from "@/lib/authBackend";

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

  // Não renova o token aqui: um 401 do backend volta como 401 pro navegador,
  // que renova pela rota /api/sessao/renovar e repete a busca (o preview usa
  // fetchComRenovacao, src/lib/renovarSessao.ts) -- mesmo desenho do proxy de
  // JSON (src/app/api/backend/[...path]/route.ts).
  const respostaEvidencias = await fetch(
    new URL(
      `/api/modulos/legalizacao/documentos/${documentoId}/evidencias/`,
      process.env.NEXT_PUBLIC_API_URL,
    ),
    { headers: { Authorization: `Bearer ${token.backendAccessToken}` } },
  );

  if (respostaEvidencias.status === 401) {
    return NextResponse.json({ detail: "Sessão expirada." }, { status: 401 });
  }
  if (!respostaEvidencias.ok) {
    return NextResponse.json(
      { detail: "Documento não encontrado." },
      { status: respostaEvidencias.status === 404 ? 404 : 502 },
    );
  }

  const evidencias = (await respostaEvidencias.json()) as { arquivo: string; vigente: boolean }[];
  const vigente = evidencias.find((evidencia) => evidencia.vigente);
  if (!vigente) {
    return NextResponse.json(
      { detail: "Nenhuma evidência vigente para este documento." },
      { status: 404 },
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
    return NextResponse.json({ detail: "Não foi possível baixar o arquivo." }, { status: 502 });
  }

  // arrayBuffer() (não .text(), como o proxy de JSON) -- texto corrompe
  // conteúdo binário.
  const bytes = await respostaArquivo.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    // Fixo, não repassado da origem (achado em code review): esta rota só
    // serve pré-visualização de evidência regulatória, sempre PDF por
    // desenho -- nada aqui garante que o upload original tenha sido
    // validado como PDF de verdade (accept=".pdf" no input é só dica de
    // UI, não filtra drag-and-drop nem é reenviado ao servidor). Fixar o
    // header evita depender dessa garantia externa, em vez de repassar o
    // que a origem mandar pra dentro de um iframe same-origin.
    headers: { "Content-Type": "application/pdf" },
  });
}
