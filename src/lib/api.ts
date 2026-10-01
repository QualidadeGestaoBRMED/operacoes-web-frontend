import axios, { type InternalAxiosRequestConfig } from "axios";
import { encerrarSessao, renovarSessao } from "./renovarSessao";

// Chama o proxy same-origin em /api/backend, nao o Django direto: o bearer
// token fica só no server-side do Next.js (rota + getToken), nunca acessível
// a JS do navegador. Ver src/app/api/backend/[...path]/route.ts.
const api = axios.create({
  baseURL: "/api/backend",
});

type ConfigComRenovacao = InternalAxiosRequestConfig & { _renovacaoTentada?: boolean };

// 401 = access expirado: renova a sessão (src/lib/renovarSessao.ts) e repete
// a requisição uma vez. Só leva ao login se a renovação falhar ou se a
// requisição repetida voltar 401 de novo -- a repetida não entra em outra
// renovação, senão uma sessão inválida viraria laço.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const config = error.config as ConfigComRenovacao | undefined;
      if (config && !config._renovacaoTentada) {
        config._renovacaoTentada = true;
        if (await renovarSessao()) {
          return api.request(config);
        }
      }
      encerrarSessao();
    }
    return Promise.reject(error);
  },
);

export default api;
