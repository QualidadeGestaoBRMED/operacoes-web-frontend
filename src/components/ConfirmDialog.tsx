"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Substitui window.confirm() (usado antes em AnexoList.tsx/ResponsavelSection.tsx
// -- feio e não combina com o resto da UI, ver captura de tela). Genérico de
// propósito: só texto + callback, reutilizável em qualquer módulo que precise
// de uma confirmação antes de uma ação (não só Gestão de Demandas).
export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  destrutivo = false,
  isLoading = false,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  // Texto, ou texto com destaque (ex.: nome do que vai ser excluído em negrito).
  descricao: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  // Ações irreversíveis (excluir, remover) usam o botão vermelho -- mesmo
  // critério visual que já era usado só no ícone/hover antes do window.confirm.
  destrutivo?: boolean;
  isLoading?: boolean;
  onConfirmar: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{textoCancelar}</AlertDialogCancel>
          <AlertDialogAction
            variant={destrutivo ? "destructive" : "default"}
            onClick={(evento) => {
              // AlertDialogAction fecha o dialog sozinho ao clicar (Radix) --
              // preventDefault mantém aberto enquanto isLoading, pra não
              // deixar clicar de novo/fechar no meio de uma request em voo.
              if (isLoading) {
                evento.preventDefault();
                return;
              }
              onConfirmar();
            }}
            disabled={isLoading}
          >
            {textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
