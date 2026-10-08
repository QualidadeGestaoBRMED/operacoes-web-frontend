/**
 * Identificador do documento da Legalização (`DocumentoUnidade.profissional`)
 * como o backend grava (legalizacao.models.normalizar_identificador): em
 * maiúsculas, sem espaços nas pontas e com espaços repetidos trocados por um
 * só. Usado para comparar com o que já está cadastrado e para enviar o valor
 * final; enquanto a pessoa digita, o campo só exibe em maiúsculas
 * (`CLASSE_CAMPO_IDENTIFICADOR`), sem reescrever o valor e mexer no cursor.
 */
export function normalizarIdentificador(texto: string): string {
  return texto.trim().split(/\s+/).filter(Boolean).join(" ").toUpperCase();
}

/** Tipo de documento que usa identificador: profissional ou múltiplas instâncias. */
export function usaIdentificador(tipo: {
  controlado_por_profissional?: boolean;
  permite_multiplas_instancias?: boolean;
}): boolean {
  return Boolean(tipo.controlado_por_profissional || tipo.permite_multiplas_instancias);
}

// Exibe em maiúsculas enquanto digita; o placeholder continua como está.
export const CLASSE_CAMPO_IDENTIFICADOR = "uppercase placeholder:normal-case";
