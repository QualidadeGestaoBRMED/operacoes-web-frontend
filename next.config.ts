import type { NextConfig } from "next";

// STC-233: Vercel não injeta nenhum header de segurança por padrão -- sem
// isso, a aplicação podia ser carregada dentro de um <iframe> de qualquer
// site (clickjacking contra usuário já autenticado). Nenhum lugar do app usa
// iframe (conferido), então DENY/frame-ancestors 'none' não quebra nada.
//
// Content-Security-Policy completa (default-src, script-src etc.) fica de
// fora de propósito -- exigiria levantar todo domínio externo que a
// aplicação carrega hoje (fontes do Next, avatar do Google na Topbar) sem
// quebrar nada, escopo maior que cabe numa issue separada. frame-ancestors
// sozinho não precisa dessa análise (só controla quem pode enquadrar a
// página, não o que a página carrega).
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
          // X-Frame-Options (fallback pra navegador antigo) + frame-ancestors
          // via CSP (o que navegador moderno de fato respeita) -- os dois
          // juntos é a recomendação padrão, não redundância à toa.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
