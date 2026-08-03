import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
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
