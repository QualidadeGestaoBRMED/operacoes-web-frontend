import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { encerrarSessao, renovacaoJaCobre, renovarSessao } from "./renovarSessao";
import {
  CABECALHO_VER_COMO,
  CODIGO_SOMENTE_LEITURA,
  CODIGOS_DE_FIM,
  MENSAGEM_SOMENTE_LEITURA,
  sairDoVerComo,
  sessaoVerComo,
} from "./verComo";

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

declare module "axios" {
  interface AxiosRequestConfig {
    /** Vai como o próprio Admin, sem o "ver como" (começar e sair dele). */
    _semVerComo?: boolean;
  }
}

const METODOS_DE_LEITURA = ["get", "head", "options"];

api.interceptors.request.use((config: ConfigComRenovacao) => {
  config._enviadaEm = Date.now();
  // "Ver como" (STC-790): leitura vai com o id da sessão no cabeçalho e é
  // respondida como a pessoa; escrita nem sai daqui, com a mesma recusa que
  // o backend daria (ele recusa de qualquer jeito, STC-789).
  const verComo = config._semVerComo ? null : sessaoVerComo();
  if (verComo) {
    if (!METODOS_DE_LEITURA.includes((config.method ?? "get").toLowerCase())) {
      const resposta = {
        status: 403,
        statusText: "Forbidden",
        headers: {},
        config,
        data: { detail: MENSAGEM_SOMENTE_LEITURA, codigo: CODIGO_SOMENTE_LEITURA },
      } as AxiosResponse;
      return Promise.reject(
        new AxiosError(MENSAGEM_SOMENTE_LEITURA, AxiosError.ERR_BAD_REQUEST, config, null, resposta),
      );
    }
    config.headers.set(CABECALHO_VER_COMO, verComo.id);
  }
  return config;
});

// 401 = access expirado. Se a requisição saiu antes da última renovação
// terminar, levou o cookie antigo: só repete. Senão, renova a sessão
// (src/lib/renovarSessao.ts) e repete uma vez. Só leva ao login se a
// renovação for recusada ou se a requisição repetida depois de renovar voltar
// 401 de novo -- essa não entra em outra renovação, senão uma sessão inválida
// viraria laço. Se não deu pra renovar agora (sem rede, backend fora do ar),
// a requisição falha sem deslogar.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // O "ver como" não vale mais no backend (vencido, encerrado em outra aba,
    // cargo mudado): volta a ser o Admin, com o aviso na próxima tela.
    const codigo = error.response?.data?.codigo;
    // Começar e sair (_semVerComo) vão como o Admin e cuidam do próprio
    // resultado: aqui não podem disparar outra navegação.
    if (
      error.response?.status === 403 &&
      CODIGOS_DE_FIM.includes(codigo) &&
      !error.config?._semVerComo &&
      sessaoVerComo()
    ) {
      sairDoVerComo("/admin/permissoes", error.response.data.detail);
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      const config = error.config as ConfigComRenovacao | undefined;
      // A repetida depois de renovar sai no mesmo milissegundo em que a
      // renovação termina, e renovacaoJaCobre a contaria como "saiu antes".
      if (
        config &&
        !config._repetidaSemRenovar &&
        !config._renovacaoTentada &&
        renovacaoJaCobre(config._enviadaEm ?? 0)
      ) {
        config._repetidaSemRenovar = true;
        return api.request(config);
      }
      if (config && !config._renovacaoTentada) {
        config._renovacaoTentada = true;
        const renovacao = await renovarSessao();
        if (renovacao === "renovada") return api.request(config);
        if (renovacao === "indisponivel") return Promise.reject(error);
      }
      encerrarSessao();
    }
    return Promise.reject(error);
  },
);

export default api;
