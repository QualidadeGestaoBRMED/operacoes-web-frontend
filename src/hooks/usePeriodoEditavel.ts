"use client";

import { useState } from "react";

export interface Periodo {
  inicio: string;
  fim: string;
}

function valido(periodo: Periodo): boolean {
  return Boolean(periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim);
}

/**
 * Período de consulta editável (painel e aba Absenteísmo). O editado só vira
 * `periodo` quando é válido: com o fim antes do início, a tela continua no
 * último período válido.
 */
export function usePeriodoEditavel(inicial: Periodo) {
  const [editado, setEditado] = useState(inicial);
  const [periodo, setPeriodo] = useState(inicial);

  function editar(campo: keyof Periodo, valor: string) {
    const novo = { ...editado, [campo]: valor };
    setEditado(novo);
    if (valido(novo)) setPeriodo(novo);
  }

  return { periodo, editado, valido: valido(editado), editar };
}
