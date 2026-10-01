import axios, { type InternalAxiosRequestConfig } from "axios";
import { encerrarSessao, renovacaoJaCobre, renovarSessao } from "./renovarSessao";

// Chama o proxy same-origin em /api/backend, nao o Django direto: o bearer
// token fica só no server-side do Next.js (rota + getToken), nunca acessível
// a JS do navegador. Ver src/app/api/backend/[...path]/route.ts.
const api = axios.create({
  baseURL: "/api/backend",
});

type ConfigComRenovacao = InternalAxiosRequestConfig & {
  _enviadaEm?: number;
  _repetidaSemRenovar?: boolean;
  _renovacaoTentada?: boolean;
};

api.interceptors.request.use((config: ConfigComRenovacao) => {
  config._enviadaEm = Date.now();
  return config;
});

// 401 = access expirado. Se a requisição saiu antes da última renovação
// terminar, levou o cookie antigo: só repete. Senão, renova a sessão
// (src/lib/renovarSessao.ts) e repete uma vez. Só leva ao login se a
// renovação falhar ou se a requisição repetida depois de renovar voltar 401
// de novo -- essa não entra em outra renovação, senão uma sessão inválida
// viraria laço.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const config = error.config as ConfigComRenovacao | undefined;
      if (config && !config._repetidaSemRenovar && renovacaoJaCobre(config._enviadaEm ?? 0)) {
        config._repetidaSemRenovar = true;
        return api.request(config);
      }
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
