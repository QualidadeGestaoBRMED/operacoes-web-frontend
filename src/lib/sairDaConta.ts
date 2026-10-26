"use client";

import { signOut } from "next-auth/react";
import { encerrarVerComo } from "./plataforma";
import { cancelarPushAoSair } from "./pushNotificacoes";
import { limparVerComo, sessaoVerComo } from "./verComo";

/**
 * Sair da conta. Em "ver como" (STC-790), encerra antes a sessão no backend
 * (a trilha fica com o fim) e a tira desta aba: quem entrar em seguida aqui
 * não herda o cabeçalho de outra pessoa. Cancela também as notificações no
 * celular deste aparelho (STC-851): num celular compartilhado, quem entra
 * depois não recebe os avisos de quem saiu. Depois do "ver como", para o
 * cancelamento ir como o próprio dono do aparelho.
 */
export async function sairDaConta() {
  const verComo = sessaoVerComo();
  if (verComo) {
    try {
      await encerrarVerComo(verComo.id);
    } catch {
      // Sem rede: a sessão vence sozinha em até 1 hora.
    }
    limparVerComo();
  }
  await cancelarPushAoSair();
  await signOut({ redirectTo: "/login" });
}
