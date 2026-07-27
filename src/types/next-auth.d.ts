import type { DefaultSession } from "next-auth";
import type { Usuario } from "@/types";

declare module "@auth/core/types" {
  interface Session {
    // backendAccessToken não entra aqui de propósito: fica só no JWT
    // server-side (ver route.ts do proxy), nunca exposto a JS do cliente.
    error?: "BackendAuthError";
    // `id` não entra aqui: o `id` da sessão é o `sub` (string) do Google,
    // enquanto o PK do Usuario no Django é numérico — expostos como campos distintos.
    user: DefaultSession["user"] & Omit<Partial<Usuario>, "id"> & { usuarioId?: number };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    backendAccessToken?: string;
    // Usado só pelo proxy BFF (route.ts) pra renovar o access token sozinho
    // quando ele expira -- STC-208. Nunca chega no client (mesmo motivo do
    // backendAccessToken não entrar em Session acima).
    backendRefreshToken?: string;
    backendUser?: Usuario;
    error?: "BackendAuthError";
  }
}
