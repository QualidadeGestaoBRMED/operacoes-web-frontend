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

  // O backend também devolve "refresh", mas não há fluxo de refresh
  // implementado no frontend ainda — não armazenamos o que não usamos.
  return response.json() as Promise<{ access: string; user: Usuario }>;
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
      if (!profile?.email_verified) return false;
      if (!profile.email?.endsWith("@grupobrmed.com.br")) return false;
      // hd só vem preenchido em contas Workspace; quando presente, precisa bater
      // com o domínio — o backend reforça a mesma checagem como fonte da verdade.
      if (profile.hd && profile.hd !== "grupobrmed.com.br") return false;
      return true;
    },
    async jwt({ token, account }) {
      if (account?.id_token) {
        try {
          const dados = await trocarTokenComBackend(account.id_token);
          token.backendAccessToken = dados.access;
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
