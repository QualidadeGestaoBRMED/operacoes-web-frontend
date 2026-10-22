"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Desativar documento (STC-853/854), no lugar da exclusão: só Admin, com
 * justificativa obrigatória. Nada é apagado; o documento sai de cena.
 */
export function DesativarDocumentoDialog({
  aberto,
  onOpenChange,
  nomeDocumento,
  nomeUnidade,
  isLoading,
  onConfirmar,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  nomeDocumento: string;
  nomeUnidade: string;
  isLoading: boolean;
  onConfirmar: (justificativa: string) => void;
}) {
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");

  function fechar(proximo: boolean) {
    if (isLoading) return;
    if (!proximo) {
      setJustificativa("");
      setErro("");
    }
    onOpenChange(proximo);
  }

  function confirmar() {
    if (!justificativa.trim()) {
      setErro("Obrigatória para desativar.");
      return;
    }
    onConfirmar(justificativa.trim());
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar documento</DialogTitle>
          <DialogDescription>
            O documento <strong className="text-foreground">{nomeDocumento}</strong> da
            unidade <strong className="text-foreground">{nomeUnidade}</strong> sai das telas,
            das contagens e dos alertas, e os cards abertos no Kanban vão para a Lixeira.
            Nada é apagado: evidências, histórico e renovações ficam guardados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="dd-justificativa">Justificativa</Label>
          <Textarea
            id="dd-justificativa"
            rows={3}
            maxLength={2000}
            value={justificativa}
            onChange={(evento) => setJustificativa(evento.target.value)}
            aria-invalid={!!erro}
            aria-describedby={erro ? "dd-justificativa-erro" : undefined}
          />
          {erro && (
            <p id="dd-justificativa-erro" role="alert" className="text-xs text-destructive">
              {erro}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => fechar(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={isLoading}>
            {isLoading ? "Desativando..." : "Desativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
