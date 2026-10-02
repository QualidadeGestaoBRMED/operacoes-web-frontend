// Nonce gerado por requisição (consumido em auth.ts, callback authorized) --
// não dá pra gerar isso em next.config.ts: headers() lá é estático,
// resolvido uma vez no build/start, incompatível com um valor aleatório por
// requisição. Ver https://nextjs.org/docs/app/guides/content-security-policy:
// setar o header Content-Security-Policy nos headers da REQUISIÇÃO (não só
// da resposta) é como o Next.js detecta e aplica o nonce sozinho nos scripts
// inline que ele mesmo injeta (hidratação/streaming de RSC) -- só o header
// da resposta não basta pra esses scripts internos.
// Bucket de anexos do R2 (STC-628): o navegador envia o arquivo direto para
// ele (PUT, connect-src) e mostra o PDF da evidência vindo dele (frame-src),
// por URL assinada -- o proxy BFF da Vercel recusa corpo acima de 4,5 MB.
// Variável R2_URL_BUCKET (servidor, lida a cada requisição no middleware):
// "https://<conta>.r2.cloudflarestorage.com/<bucket>/". Com o caminho do
// bucket, e não só o domínio, a CSP libera só o bucket do Atlas, e não
// qualquer bucket de qualquer conta do R2. Formato validado: o valor entra
// direto no header, e um ";" abriria diretivas novas. Fora do formato ou
// ausente (dev, E2E, sem R2), nada é liberado, e o upload direto nem é
// oferecido pelo backend nesses ambientes.
const FORMATO_URL_BUCKET = /^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com\/[a-z0-9.-]+\/$/;

function origemDoBucket(): string | null {
  const valor = process.env.R2_URL_BUCKET?.trim();
  return valor && FORMATO_URL_BUCKET.test(valor) ? valor : null;
}

export function construirCsp(nonce: string): string {
  const bucket = origemDoBucket();
  const comBucket = (diretiva: string) => (bucket ? `${diretiva} ${bucket}` : diretiva);
  return [
    "default-src 'self'",
    // Achado no code review do Tech Lead (STC-239): 'unsafe-inline' reduzia
    // bastante o valor da CSP contra XSS -- migrado pra nonce.
    `script-src 'self' 'nonce-${nonce}'`,
    // style-src continua com 'unsafe-inline' de propósito -- nonce não cobre
    // o atributo style="" inline (só <style nonce>, regra do próprio CSP;
    // cobrir isso precisaria de 'unsafe-hashes' com hash pré-calculado por
    // valor, inviável pra cor de etiqueta/largura que são dinâmicas em
    // runtime). App usa style={{...}} de verdade em alguns componentes
    // (DemandaCard, KanbanColumn, SeletorEtiquetas, ModuleTile).
    "style-src 'self' 'unsafe-inline'",
    // Levantamento real do que a aplicação carrega hoje: só o avatar do
    // Google na Topbar (googleusercontent.com) além de assets locais --
    // nenhum uso de data:/blob: pra imagem em lugar nenhum (sem preview de
    // anexo, sem canvas, sem upload com preview).
    "img-src 'self' https://*.googleusercontent.com",
    // Geist Mono via next/font/google se auto-hospeda no build -- nenhum
    // request pra fonts.googleapis.com/fonts.gstatic.com em runtime.
    "font-src 'self'",
    // Todo fetch do client passa pelo proxy same-origin em /api/backend
    // (src/lib/api.ts, baseURL relativo) -- 'self' basta, fora o envio
    // direto de arquivo ao bucket (comBucket, acima). Login é redirect
    // de página inteira via NextAuth (sem Google Identity Services no
    // browser); troca de id_token por token do backend roda server-side,
    // no callback jwt, nunca no client.
    comBucket("connect-src 'self'"),
    // Achado no code review do Tech Lead (STC-239): baseline de CSP mesmo
    // sem uso de <object>/<embed>/<applet> hoje (conferido) -- fecha
    // superfície de conteúdo plugin/embeddable legado.
    "object-src 'none'",
    // Explícito em vez de herdar de default-src implicitamente. "self blob:"
    // (não mais 'none', achado testando a Biblioteca de Documentos, STC-416):
    // o preview de PDF embeda um <iframe src="blob:..."> montado no client a
    // partir de bytes já buscados via /api/media (proxy same-origin) -- sem
    // "blob:" aqui, o frame-src bloqueia a própria blob URL que a página
    // criou, mesmo sendo conteúdo 100% local. Esse é o caminho sem R2 (dev,
    // E2E); com R2, o preview embeda a URL assinada do PDF direto do bucket
    // (comBucket, acima). Nenhuma outra origem.
    comBucket("frame-src 'self' blob:"),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function gerarNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
