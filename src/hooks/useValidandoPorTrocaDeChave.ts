"use client";

import { useState } from "react";

// SWR marca isValidating=true em qualquer revalidação -- troca de filtro
// (chave nova) OU um polling em segundo plano (mesma chave, nada mudou pro
// usuário ver). UI que esmaece a tela enquanto isValidating (pra suavizar
// troca de filtro) só deve fazer isso na 1ª situação -- achado no review do
// STC-206: sem essa distinção, o polling fazia a tela piscar cinza a cada
// tick, sem nenhuma mudança visível que justificasse.
export function useValidandoPorTrocaDeChave(chave: unknown, isValidating: boolean): boolean {
  const chaveAtual = JSON.stringify(chave);
  const [chaveAssentada, setChaveAssentada] = useState(chaveAtual);
  if (!isValidating && chaveAssentada !== chaveAtual) {
    setChaveAssentada(chaveAtual);
  }
  return isValidating && chaveAssentada !== chaveAtual;
}
