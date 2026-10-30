import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { caminhoDoPython } from "./e2e/python-bin";

// Portas dedicadas (8001/3100), diferentes das que o dev usa manualmente
// (8000/3000) -- reuseExistingServer:false garante que a suíte nunca
// reaproveita um servidor manual (apontaria pro backend/porta errado
// silenciosamente) e nunca compartilha banco/`.next` com o ambiente de
// desenvolvimento normal.
const BACKEND_URL = "http://localhost:8001";
const FRONTEND_URL = "http://localhost:3100";
const BACKEND_DIR = path.resolve(__dirname, "../backend");
const PYTHON = caminhoDoPython(BACKEND_DIR);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testIgnore: /celular\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    // Tela de celular (STC-959): o que só quebra com a emulação de aparelho
    // (toque e tela de celular), não numa janela estreita do computador.
    {
      name: "celular",
      testMatch: /celular\.spec\.ts/,
      use: { ...devices["Pixel 7"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      // rm -f garante estado limpo a cada execução -- sem isso, demandas
      // criadas por uma rodada da suíte ficariam acumulando no banco e
      // poderiam quebrar asserções de rodadas futuras. PYTHON (não mais
      // "venv/bin/python" hardcoded) vem de e2e/python-bin.ts -- ver
      // comentário lá sobre por que caminho absoluto e PYTHON_BIN.
      command:
        `rm -f db.e2e.sqlite3 && "${PYTHON}" manage.py migrate --settings=core.settings.e2e --noinput && "${PYTHON}" manage.py runserver 8001 --settings=core.settings.e2e`,
      cwd: "../backend",
      url: `${BACKEND_URL}/health/`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Build de produção, não `next dev` -- achado rodando a suíte pela
      // 1ª vez: em dev/Turbopack, compilação sob demanda de uma rota ainda
      // não visitada (ex.: /api/auth/[...nextauth], acionada pelo primeiro
      // GET /api/auth/session) dispara um Fast Refresh no cliente mesmo sem
      // nenhum arquivo mudar -- se isso cai bem no instante de um clique,
      // o remount descarta o estado React local (ex.: o open do modal),
      // e o clique em "Nova Demanda" some sem erro nenhum no console.
      // `next build` elimina compilação sob demanda em runtime.
      command: "npm run build && npm run start -- -p 3100",
      env: {
        NEXT_PUBLIC_API_URL: BACKEND_URL,
        PLAYWRIGHT_E2E: "1",
        // .env.local fixa NEXTAUTH_URL em :3000 -- sem sobrescrever aqui,
        // qualquer redirect do NextAuth (ex.: sessão ausente -> /login)
        // aponta pra localhost:3000 mesmo rodando em :3100, e nada escuta
        // lá durante a suíte (achado rodando o probe de prontidão do
        // Playwright manualmente: a resposta em si chegava rápido, mas o
        // location do 307 ia pra outra porta).
        NEXTAUTH_URL: FRONTEND_URL,
        AUTH_URL: FRONTEND_URL,
      },
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
