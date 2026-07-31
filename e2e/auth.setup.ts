import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { caminhoDoPython } from "./python-bin";

const ARQUIVO_SESSAO = "playwright/.auth/user.json";
const SETE_DIAS_EM_SEGUNDOS = 60 * 60 * 24 * 7;
const BACKEND_DIR = path.resolve(__dirname, "../../backend");

// Achado no code review do Tech Lead: só ler de .env.local prendia a suíte
// ao layout de dev local -- CI (e qualquer ambiente que injete segredo via
// variável de ambiente, sem nenhum .env.local no disco) falhava mesmo com o
// segredo disponível. process.env é a fonte de verdade quando existe (é
// assim que o Auth.js v5 também resolve o segredo em produção); .env.local
// vira só o fallback de conveniência pra dev local, onde `next dev` carrega
// esse arquivo sozinho pro processo do Next mas este script roda isolado
// (fora do Next.js) e não tem esse carregamento automático.
function obterSegredo(): string {
  const doAmbiente = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (doAmbiente) return doAmbiente;
  return lerSegredoDoEnvLocal();
}

function lerSegredoDoEnvLocal(): string {
  let conteudo: string;
  try {
    conteudo = readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8");
  } catch {
    throw new Error(
      "NEXTAUTH_SECRET não definido -- defina a variável de ambiente NEXTAUTH_SECRET " +
        "(ou AUTH_SECRET) ou crie um .env.local com NEXTAUTH_SECRET=... pra rodar a suíte localmente.",
    );
  }
  const linha = conteudo.split("\n").find((l) => l.startsWith("NEXTAUTH_SECRET="));
  if (!linha) {
    throw new Error(
      "NEXTAUTH_SECRET não encontrado em .env.local -- necessário pra assinar a sessão forjada da suíte E2E.",
    );
  }
  return linha.slice("NEXTAUTH_SECRET=".length).trim();
}

// Mesma receita usada manualmente a sessão inteira pra verificação ao vivo
// (RefreshToken.for_user() no Django + encode() do next-auth/jwt) -- aqui
// formalizada como setup automático, sem depender do Google OAuth real.
setup("gera sessão autenticada do usuário Admin Q&G seedado", async ({ context }) => {
  const saida = execFileSync(
    caminhoDoPython(BACKEND_DIR),
    ["manage.py", "seed_e2e_usuario", "--settings=core.settings.e2e"],
    { cwd: BACKEND_DIR, encoding: "utf-8" },
  );
  const ultimaLinha = saida.trim().split("\n").pop();
  if (!ultimaLinha) throw new Error("seed_e2e_usuario não imprimiu nada em stdout.");
  const { access, refresh, user } = JSON.parse(ultimaLinha) as {
    access: string;
    refresh: string;
    user: {
      id: number;
      username: string;
      email: string;
      first_name: string;
      last_name: string;
      perfil: { id: number; nome: string; descricao: string; nivel: number };
      unidade_id: number | null;
      setor_id: number | null;
      ativo: boolean;
      ultimo_acesso: string | null;
    };
  };

  const payloadDoToken = {
    sub: String(user.id),
    email: user.email,
    name: `${user.first_name} ${user.last_name}`.trim(),
    backendAccessToken: access,
    backendRefreshToken: refresh,
    backendUser: user,
  };
  const segredo = obterSegredo();

  // Achado rodando a suíte pela 1ª vez: a suíte roda `next start` sobre
  // HTTP puro (localhost, sem TLS) -- uma combinação que nunca acontece
  // fora do E2E (produção real na Vercel é sempre HTTPS; dev local é
  // sempre HTTP, mas nunca com NODE_ENV=production). Isso expõe uma
  // divergência real entre os dois pontos que decidem "secureCookie":
  // o auth() do middleware (src/auth.ts, via NextAuth) autodetecta pelo
  // protocolo da requisição -- aqui HTTP, então espera o cookie SEM
  // prefixo. Já o proxy BFF (route.ts) decide manualmente por
  // NODE_ENV==="production" -- aqui verdadeiro (build de produção), então
  // espera o cookie COM prefixo __Secure-. Os dois só concordam nos
  // ambientes reais (Vercel prod / dev local), nunca nessa combinação
  // artificial. Em vez de brigar com o NODE_ENV que o `next start` já
  // força sozinho, grava os dois cookies -- cada lado acha o que espera.
  const cookieSemPrefixo = await encode({
    token: payloadDoToken,
    secret: segredo,
    salt: "authjs.session-token",
    maxAge: SETE_DIAS_EM_SEGUNDOS,
  });
  const cookieComPrefixo = await encode({
    token: payloadDoToken,
    secret: segredo,
    salt: "__Secure-authjs.session-token",
    maxAge: SETE_DIAS_EM_SEGUNDOS,
  });

  await context.addCookies([
    {
      name: "authjs.session-token",
      value: cookieSemPrefixo,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "__Secure-authjs.session-token",
      value: cookieComPrefixo,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);

  await context.storageState({ path: ARQUIVO_SESSAO });
});
