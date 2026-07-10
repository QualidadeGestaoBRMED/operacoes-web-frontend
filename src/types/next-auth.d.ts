import type { DefaultSession } from "next-auth";
import type { Usuario } from "@/types";

declare module "@auth/core/types" {
  interface Session {
    backendAccessToken?: string;
    error?: "BackendAuthError";
    // `id` não entra aqui: o `id` da sessão é o `sub` (string) do Google,
    // enquanto o PK do Usuario no Django é numérico — expostos como campos distintos.
    user: DefaultSession["user"] & Omit<Partial<Usuario>, "id"> & { usuarioId?: number };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    backendAccessToken?: string;
    backendRefreshToken?: string;
    backendUser?: Usuario;
    error?: "BackendAuthError";
  }
}
