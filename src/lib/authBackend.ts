import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Extraído de src/app/api/backend/[...path]/route.ts -- achado no code
// review: a mesma configuração de getToken() (secureCookie/secret) ia ser
// duplicada de novo no proxy de mídia (src/app/api/media/.../route.ts), os
// dois precisam decidir "este pedido tem uma sessão válida?" do mesmo jeito.
const SECURE_COOKIE = process.env.NODE_ENV === "production";
const SEGREDO = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

// getToken() é o helper standalone de next-auth/jwt -- diferente do
// auth()/handlers exportados por src/auth.ts, ele não detecta o secret
// sozinho a partir do NextAuth({...}) principal. Precisa receber
// explicitamente, senão lança MissingSecret.
//
// secureCookie não é autodetectado por getToken() -- sem passar, ele assume
// "false" e procura o cookie "authjs.session-token" (sem prefixo). Em
// produção (HTTPS) o NextAuth grava a sessão como
// "__Secure-authjs.session-token"; sem secureCookie:true aqui, getToken()
// nunca acha o cookie certo e sempre volta null.
export async function obterTokenBackend(request: NextRequest) {
  return getToken({ req: request, secret: SEGREDO, secureCookie: SECURE_COOKIE });
}
