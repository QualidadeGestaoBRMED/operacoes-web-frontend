import axios from "axios";
import { signOut } from "next-auth/react";

// Chama o proxy same-origin em /api/backend, nao o Django direto: o bearer
// token fica só no server-side do Next.js (rota + getToken), nunca acessível
// a JS do navegador. Ver src/app/api/backend/[...path]/route.ts.
const api = axios.create({
  baseURL: "/api/backend",
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      signOut({ redirectTo: "/login" });
    }
    return Promise.reject(error);
  },
);

export default api;
