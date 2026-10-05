import { headers } from "next/headers";

// O backend só recebe requisições do servidor do frontend (proxy BFF, NextAuth),
// nunca do navegador: sem repassar estes cabeçalhos, a trilha de auditoria do
// backend (STC-630, plataforma/auditoria.py) registraria o IP da função da
// Vercel e o User-Agent do Node em todo login, logout e ação administrativa
// (STC-637).
//
// IP: o primeiro item do x-forwarded-for da requisição de entrada, que a
// Vercel monta com o IP de quem chamou (ela descarta o valor que vier do
// cliente). Sem ele (dev, `next start` local), nada é enviado -- melhor o
// backend registrar o IP da conexão do que um valor inventado aqui.
//
// Do lado do backend, continua sendo um valor declarado: quem chama o backend
// direto pode forjá-lo (STC-632).

const TAMANHO_MAXIMO_USER_AGENT = 300; // RegistroAuditoria.user_agent
// Só dígitos, hexa, ponto e dois-pontos: IPv4 ou IPv6. Qualquer outra coisa
// não é repassada.
const FORMATO_IP = /^[0-9a-fA-F.:]{2,45}$/;

type CabecalhosDeEntrada = Pick<Headers, "get">;

export function cabecalhosDoCliente(entrada: CabecalhosDeEntrada): Record<string, string> {
  const cabecalhos: Record<string, string> = {};
  const ip = entrada.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip && FORMATO_IP.test(ip)) cabecalhos["X-Forwarded-For"] = ip;
  const userAgent = entrada.get("user-agent")?.trim();
  if (userAgent) cabecalhos["User-Agent"] = userAgent.slice(0, TAMANHO_MAXIMO_USER_AGENT);
  return cabecalhos;
}

/** Os mesmos cabeçalhos, a partir da requisição em andamento, para quem não
 * recebe o objeto da requisição (callbacks e eventos do NextAuth). Fora de
 * uma requisição (ex.: o callback jwt rodando no middleware), não há o que
 * repassar. */
export async function cabecalhosDaRequisicaoAtual(): Promise<Record<string, string>> {
  try {
    return cabecalhosDoCliente(await headers());
  } catch {
    return {};
  }
}
