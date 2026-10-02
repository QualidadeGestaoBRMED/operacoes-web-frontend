// Bucket de anexos do R2 (STC-628): o navegador envia o arquivo direto para
// ele e mostra o PDF da evidência vindo dele, por URL assinada -- a função da
// Vercel recusa corpo e resposta acima de 4,5 MB.
//
// NEXT_PUBLIC_R2_URL_BUCKET: "https://<conta>.r2.cloudflarestorage.com/<bucket>/".
// Pública de propósito (não é segredo, está em toda URL assinada): a CSP
// (src/lib/csp.ts) libera esse caminho, e o navegador precisa saber se ele
// está liberado antes de abrir a pré-visualização direto do bucket
// (useEvidenciasLegalizacao.ts). Formato validado: o valor entra direto no
// header da CSP, e um ";" abriria diretivas novas. Com o caminho do bucket, e
// não só o domínio, só o bucket do Atlas é liberado, e não qualquer bucket do
// R2. Fora do formato ou ausente (dev, E2E), nada é liberado.
const FORMATO_URL_BUCKET = /^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com\/[a-z0-9.-]+\/$/;

export function urlDoBucketR2(): string | null {
  const valor = process.env.NEXT_PUBLIC_R2_URL_BUCKET?.trim();
  return valor && FORMATO_URL_BUCKET.test(valor) ? valor : null;
}

/** Se `url` aponta para o bucket liberado na CSP. */
export function estaNoBucketR2(url: string): boolean {
  const bucket = urlDoBucketR2();
  return bucket !== null && url.startsWith(bucket);
}
