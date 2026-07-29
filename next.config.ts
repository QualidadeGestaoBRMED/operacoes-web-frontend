import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // STC-216: a suite E2E sobe seu próprio `next dev` numa porta separada
  // (3100), em paralelo a um `npm run dev` manual que o dev possa ter aberto
  // na 3000 -- sem separar o distDir, os dois processos escrevendo no mesmo
  // `.next/` corrompem o manifest do Turbopack (bug já visto várias vezes
  // nesta sessão em outro contexto: 2 instâncias de `next dev` na mesma
  // pasta).
  distDir: process.env.PLAYWRIGHT_E2E === "1" ? ".next-e2e" : ".next",
};

export default nextConfig;
