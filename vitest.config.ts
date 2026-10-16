import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Fuso dos testes, fixo em qualquer máquina (CI ou UTC): as datas da tela
// são mostradas no fuso de Brasília. Precisa valer antes de as threads dos
// testes nascerem -- dentro de uma thread, mudar process.env.TZ não tem
// efeito, então ajustar no próprio teste não funciona.
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // STC-727: threads em vez de processos (padrão "forks"): a suíte inteira
    // cai de ~88 s para ~72 s na máquina de desenvolvimento (12 núcleos).
    pool: "threads",
    // Com todos os arquivos em paralelo, os formulários pesados de
    // Legalização (vários Select do Radix por teste) chegam a dobrar de
    // duração e passavam do padrão de 5 s, falhando sem relação com o código
    // alterado. 15 s deixa folga para essa carga sem esconder teste travado.
    testTimeout: 15_000,
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ é suíte do Playwright (STC-216), não do Vitest -- sem excluir,
    // vitest tenta importar e2e/*.spec.ts e quebra em "test() did not
    // expect to be called here" (os dois pacotes exportam um test() global
    // incompatível entre si).
    exclude: ["**/node_modules/**", "e2e/**"],
    // next-auth importa "next/server" (bare specifier) -- o package.json do
    // next não tem "exports" declarado pra esse subpath, então, tratado
    // como dependência externa (padrão do Vitest), a resolução ESM estrita
    // do Node não achava o arquivo fora do bundler do próprio Next (achado
    // escrevendo o teste de src/auth.ts, STC-239). "inline" processa
    // next-auth/@auth/core pelo resolvedor do Vite em vez do Node direto.
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
  },
});
