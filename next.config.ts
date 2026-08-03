import type { NextConfig } from "next";

// STC-233 (headers básicos, aplicados globalmente aqui) + STC-239 (CSP
// completa) -- a CSP em si NÃO mora mais aqui (achado no code review do
// Tech Lead: script-src precisava de nonce por requisição pra sair de
// 'unsafe-inline', e headers() é estático, resolvido uma vez no
// build/start, incompatível com um valor aleatório por requisição). A CSP
// de verdade é montada em src/auth.ts (callback authorized), que já roda a
// cada requisição de página -- ver construirCsp()/gerarNonce() em
// src/lib/csp.ts (já inclui frame-ancestors 'none', não repetido aqui).
// Isso também é correto por escopo: o matcher do middleware
// (src/middleware.ts) exclui api/_next/arquivos com extensão -- exatamente
// onde CSP não tem efeito nenhum (não são documentos HTML renderizados).
const nextConfig: NextConfig = {
  // STC-216: a suite E2E sobe seu próprio build (`next build && next start`)
  // numa porta separada (3100), em paralelo a um `npm run dev` manual que o
  // dev possa ter aberto na 3000 -- sem separar o distDir, os dois
  // processos escrevendo no mesmo `.next/` corrompem o manifest do
  // Turbopack (bug já visto várias vezes nesta sessão em outro contexto: 2
  // instâncias de `next dev` na mesma pasta).
  distDir: process.env.PLAYWRIGHT_E2E === "1" ? ".next-e2e" : ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
