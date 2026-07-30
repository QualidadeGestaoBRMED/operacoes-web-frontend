import type { NextConfig } from "next";

// STC-233 (headers básicos) + STC-239 (CSP completa) -- consolidados no
// mesmo headers(), já que as duas issues mexem na mesma lista. Se as
// branches divergirem na ordem de merge, é só combinar as duas listas de
// header, sem lógica pra reconciliar.
//
// Levantamento real (não suposição) do que a aplicação carrega hoje, feito
// antes de escrever a policy:
// - img-src: only o avatar do Google na Topbar (googleusercontent.com,
//   qualquer subdomínio lh*) além de assets locais.
// - connect-src: todo fetch do client passa pelo proxy same-origin em
//   /api/backend (src/lib/api.ts, baseURL relativo) -- 'self' basta.
// - font-src: Geist Mono via next/font/google se auto-hospeda no build,
//   nenhum request pra fonts.googleapis.com/fonts.gstatic.com em runtime.
//
// script-src/style-src usam 'unsafe-inline' em vez de nonce, decisão
// documentada (não just preguiça):
// - style-src NÃO tem como evitar 'unsafe-inline' aqui mesmo com nonce --
//   nonce cobre elemento <style nonce>, mas não o atributo style="" inline
//   (regra do próprio CSP: precisaria de 'unsafe-hashes' com hash
//   pré-calculado por valor, inviável pra cor de etiqueta/largura que são
//   dinâmicas em runtime). App usa style={{...}} de verdade em 4 lugares
//   (DemandaCard, KanbanColumn, SeletorEtiquetas, ModuleTile).
// - script-src com nonce exigiria gerar o nonce em middleware.ts -- que
//   hoje é só `export { auth as middleware }` (STC-192/208), a peça mais
//   sensível do app (gate de autenticação). Trocar por auth(req => {...})
//   só pra isso é risco desproporcional ao ganho numa issue de prioridade
//   mais baixa da lista -- fica como possível issue futura, separada e
//   cirúrgica, não bundlada aqui.
const cspDiretivas = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://*.googleusercontent.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: cspDiretivas.join("; ") },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
