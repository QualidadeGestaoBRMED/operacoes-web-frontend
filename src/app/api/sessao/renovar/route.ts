import { NextRequest, NextResponse } from "next/server";
import { obterTokenBackend } from "@/lib/authBackend";
import {
  accessValidoPorMaisDe,
  codificarCookieSessao,
  MAX_AGE_COOKIE_SEGUNDOS,
  NOME_COOKIE_SESSAO,
  renovarToken,
  SECURE_COOKIE,
} from "@/lib/renovarTokenBackend";

// Renovação silenciosa da sessão, chamada pelo navegador quando uma
// requisição volta 401 (src/lib/renovarSessao.ts). Lê o refresh do cookie
// ATUAL -- o navegador manda o cookie que tem agora, já atualizado por uma
// renovação anterior, e não a cópia que foi junto com a requisição que
// falhou. Fora de /api/auth/*, que é do NextAuth.
//
// 200: renovado, cookie regravado. 503 + Retry-After: outra renovação do
// mesmo refresh ainda está em andamento no backend, tentar de novo. 401:
// sessão inválida de verdade (refresh expirado, revogado, conta desativada).
const ACCESS_JA_RENOVADO_SEGUNDOS = 60;

export async function POST(request: NextRequest) {
  const token = await obterTokenBackend(request);
  if (!token?.backendRefreshToken) {
    return NextResponse.json({ detail: "Sem sessão." }, { status: 401 });
  }

  // O cookie que chegou aqui já tem um access válido: alguém (outra renovação,
  // o /session do NextAuth) renovou depois que a requisição que deu 401 saiu.
  // Não rotaciona de novo -- rotacionar um par válido revoga o refresh dele,
  // e uma resposta atrasada que regravasse esse par deixaria no cookie um
  // refresh revogado com access de 1h, derrubando a sessão na próxima
  // renovação. 200 sem mexer no cookie: o navegador repete com o cookie atual.
  // 60s de folga cobrem diferença de relógio entre este servidor e o backend.
  if (accessValidoPorMaisDe(token.backendAccessToken, ACCESS_JA_RENOVADO_SEGUNDOS)) {
    return NextResponse.json({ ok: true });
  }

  const resultado = await renovarToken(token.backendRefreshToken);

  if (resultado.tipo === "em_andamento") {
    return NextResponse.json(
      { detail: "Renovação da sessão em andamento." },
      { status: 503, headers: { "Retry-After": String(resultado.retryAfterSegundos) } },
    );
  }
  if (resultado.tipo === "recusado") {
    return NextResponse.json({ detail: "Sessão expirada." }, { status: 401 });
  }

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(NOME_COOKIE_SESSAO, await codificarCookieSessao(token, resultado.tokens), {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_COOKIE_SEGUNDOS,
  });
  return resposta;
}
