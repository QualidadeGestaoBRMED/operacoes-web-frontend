import { signOut } from "next-auth/react";
import { limparVerComo } from "./verComo";

// Renovação silenciosa da sessão, decidida pelo NAVEGADOR (STC-611, modelo do
// lib/auth-fetch.ts do ProntuAI). Quando uma requisição ao backend volta 401
// (access expirado), quem renova é a rota /api/sessao/renovar, que lê o
// cookie que o navegador tem AGORA -- não a cópia que foi junto com a
// requisição que falhou. Numa rajada (ex.: voltar pra aba e o SWR revalidar
// tudo de uma vez), as requisições que chegam depois da primeira renovação
// já encontram o cookie novo, em vez de renovar com um refresh revogado.

const ROTA_RENOVACAO = "/api/sessao/renovar";
// 503 da rota = outra renovação do mesmo refresh ainda em andamento no
// backend (janela de tolerância, STC-610): espera o Retry-After e tenta de
// novo, até este limite, antes de desistir.
const TENTATIVAS_MAXIMAS = 3;
const ESPERA_MAXIMA_RETRY_AFTER_MS = 5_000;

// "invalida": a rota respondeu 401, o refresh não vale mais -- leva ao login.
// "indisponivel": não deu pra renovar agora (sem rede, backend fora do ar,
// 503 que não passou) -- a sessão pode estar boa, então a requisição falha
// sem deslogar e a próxima tentativa (ex.: revalidação do SWR) renova de novo.
export type ResultadoRenovacaoSessao = "renovada" | "invalida" | "indisponivel";

let renovacaoEmAndamento: Promise<ResultadoRenovacaoSessao> | null = null;
let ultimaRenovacaoConcluidaEm = 0;
let sessaoEncerrada = false;

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function msDoRetryAfter(resposta: Response) {
  const segundos = Number(resposta.headers.get("Retry-After"));
  const ms = Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : 1000;
  return Math.min(ms, ESPERA_MAXIMA_RETRY_AFTER_MS);
}

async function tentarRenovar(): Promise<ResultadoRenovacaoSessao> {
  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    let resposta: Response;
    try {
      resposta = await fetch(ROTA_RENOVACAO, { method: "POST" });
    } catch {
      return "indisponivel";
    }
    if (resposta.ok) return "renovada";
    if (resposta.status === 401) return "invalida";
    if (resposta.status !== 503 || tentativa === TENTATIVAS_MAXIMAS) return "indisponivel";
    await esperar(msDoRetryAfter(resposta));
  }
  return "indisponivel";
}

/**
 * Renova a sessão. Uma renovação por vez nesta aba: chamadas concorrentes
 * (várias requisições recebendo 401 juntas) esperam a mesma.
 */
export function renovarSessao(): Promise<ResultadoRenovacaoSessao> {
  if (renovacaoEmAndamento) return renovacaoEmAndamento;
  renovacaoEmAndamento = tentarRenovar()
    .then((resultado) => {
      if (resultado === "renovada") ultimaRenovacaoConcluidaEm = Date.now();
      return resultado;
    })
    .finally(() => {
      renovacaoEmAndamento = null;
    });
  return renovacaoEmAndamento;
}

/**
 * Uma requisição que saiu ANTES da última renovação terminar levou o cookie
 * antigo: o 401 dela já está resolvido, basta repetir -- renovar de novo
 * faria uma rotação a mais do refresh, que só gasta o limite de renovações
 * do backend. Uma que saiu depois e mesmo assim levou 401 é caso novo.
 */
export function renovacaoJaCobre(enviadaEm: number) {
  // <= e não <: no mesmo milissegundo não dá pra saber a ordem. Repetir sem
  // renovar é o lado seguro -- se a repetida voltar 401, ela segue para a
  // renovação normal no próximo passo.
  return ultimaRenovacaoConcluidaEm > 0 && enviadaEm <= ultimaRenovacaoConcluidaEm;
}

/**
 * Leva ao login quando a sessão é inválida de verdade. Uma vez só: numa
 * rajada, várias requisições concluem isso ao mesmo tempo, e cada signOut()
 * é uma ida ao servidor e um redirecionamento. Se o signOut() falhar (ex.:
 * rede), libera de novo -- senão a sessão inválida nunca mais levaria ao
 * login até recarregar a página.
 */
export function encerrarSessao() {
  if (sessaoEncerrada) return;
  sessaoEncerrada = true;
  // Sessão inválida: o "ver como" desta aba (STC-790) não vale mais, e quem
  // entrar em seguida aqui não pode herdá-lo.
  limparVerComo();
  signOut({ redirectTo: "/login" }).catch(() => {
    sessaoEncerrada = false;
  });
}

/**
 * fetch() para rotas same-origin que devolvem 401 com a sessão expirada
 * (ex.: /api/media/...): renova e repete uma vez antes de levar ao login.
 * Se não deu pra renovar agora, devolve o 401 original sem deslogar.
 * Para as chamadas do Axios, o mesmo fluxo mora no interceptor de api.ts.
 */
export async function fetchComRenovacao(...argumentos: Parameters<typeof fetch>) {
  const enviadaEm = Date.now();
  const resposta = await fetch(...argumentos);
  if (resposta.status !== 401) return resposta;
  if (renovacaoJaCobre(enviadaEm)) {
    const repetida = await fetch(...argumentos);
    if (repetida.status !== 401) return repetida;
  }
  const renovacao = await renovarSessao();
  if (renovacao === "indisponivel") return resposta;
  if (renovacao === "renovada") {
    const repetida = await fetch(...argumentos);
    if (repetida.status !== 401) return repetida;
  }
  encerrarSessao();
  return resposta;
}
