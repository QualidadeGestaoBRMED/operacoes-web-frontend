import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import type { Usuario } from "@/types";

async function trocarTokenComBackend(idToken: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!response.ok) {
    throw new Error("Falha ao autenticar com o backend.");
  }

  return response.json() as Promise<{ access: string; refresh: string; user: Usuario }>;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      return profile?.email?.endsWith("@grupobrmed.com.br") ?? false;
    },
    async jwt({ token, account }) {
      if (account?.id_token) {
        try {
          const dados = await trocarTokenComBackend(account.id_token);
          token.backendAccessToken = dados.access;
          token.backendRefreshToken = dados.refresh;
          token.backendUser = dados.user;
          delete token.error;
        } catch {
          token.error = "BackendAuthError";
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.error = token.error;
      if (token.backendUser) {
        const { id: usuarioId, ...dadosUsuario } = token.backendUser;
        session.user = { ...session.user, ...dadosUsuario, usuarioId };
      }
      return session;
    },
    authorized({ auth: sessao, request }) {
      const emLogin = request.nextUrl.pathname.startsWith("/login");
      if (emLogin) return true;
      // usuarioId só existe quando o backend confirmou o login (token.backendUser).
      // backendAccessToken não fica na sessão do cliente — ver route.ts do proxy.
      return !!sessao?.user?.usuarioId;
    },
  },
});
