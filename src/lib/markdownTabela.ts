// Extrator mínimo de UMA tabela markdown de dentro de um texto maior --
// não é um parser de markdown completo (schema.info.description tem
// parágrafos/headers/listas também, fora de escopo aqui), só o suficiente
// pra puxar a tabela de "Limites de taxa" que já vem pronta e escrita à
// mão em backend/core/settings/base.py (SPECTACULAR_SETTINGS.DESCRIPTION)
// -- fonte real, não reescrita à mão duas vezes.
export function extrairTabelaMarkdown(
  texto: string | undefined,
): string[][] | null {
  if (!texto) return null;

  const linhasDaTabela = texto
    .split("\n")
    .filter((linha) => /^\s*\|.*\|\s*$/.test(linha));
  if (linhasDaTabela.length < 2) return null;

  return linhasDaTabela
    .filter((linha) => !/^\s*\|[\s|:-]+\|\s*$/.test(linha)) // linha separadora (|---|---|)
    .map((linha) =>
      linha
        .split("|")
        .slice(1, -1)
        .map((celula) => celula.trim()),
    );
}

// true quando a célula inteira é `código` -- decide se o componente
// renderiza em <code> (ex. "`POST /api/auth/google/`") ou texto comum (ex.
// "Escrita em demandas..."), sem perder essa distinção na extração.
export function celulaEhCodigo(celula: string): boolean {
  return /^`.*`$/.test(celula);
}

export function textoDaCelula(celula: string): string {
  return celula.replace(/^`(.*)`$/, "$1");
}
