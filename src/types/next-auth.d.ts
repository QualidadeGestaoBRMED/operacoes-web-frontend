import type { DefaultSession } from "next-auth";
import type { Usuario } from "@/types";

declare module "next-auth" {
  interface Session {
    backendAccessToken?: string;
    error?: "BackendAuthError";
    user: DefaultSession["user"] & Partial<Usuario>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendAccessToken?: string;
    backendRefreshToken?: string;
    backendUser?: Usuario;
    error?: "BackendAuthError";
  }
}
