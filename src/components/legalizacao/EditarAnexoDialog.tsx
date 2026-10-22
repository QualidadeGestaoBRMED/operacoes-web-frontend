"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extrairMensagemErro } from "@/lib/erros";
import { enviarEvidenciaLegalizacao } from "@/lib/legalizacao";

/**
 * "Editar anexo" (STC-853/854): troca o PDF vigente do documento por outro,
 * sem renovação, com justificativa obrigatória. O PDF anterior fica guardado
 * no histórico de evidências.
 */
export function EditarAnexoDialog({
  aberto,
  onOpenChange,
  documentoId,
  nomeArquivoAtual,
  aoTrocar,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  documentoId: number;
  nomeArquivoAtual: string;
  aoTrocar: () => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erros, setErros] = useState<{ arquivo?: string; justificativa?: string }>({});
  const [enviando, setEnviando] = useState(false);

  function fechar(proximo: boolean) {
    if (enviando) return;
    if (!proximo) {
      setArquivo(null);
      setJustificativa("");
      setErros({});
    }
    onOpenChange(proximo);
  }

  async function trocar() {
    const novosErros: typeof erros = {};
    if (!arquivo) novosErros.arquivo = "Escolha o PDF novo.";
    else if (!arquivo.name.toLowerCase().endsWith(".pdf"))
      novosErros.arquivo = "O anexo precisa ser um PDF.";
    if (!justificativa.trim()) novosErros.justificativa = "Obrigatória para trocar o PDF.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || !arquivo) return;

    setEnviando(true);
    try {
      await enviarEvidenciaLegalizacao(documentoId, arquivo, undefined, {
        justificativa: justificativa.trim(),
      });
      toast.success("PDF trocado. O anterior ficou guardado no histórico de evidências.");
      aoTrocar();
      setEnviando(false);
      fechar(false);
    } catch (erro) {
      setEnviando(false);
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar anexo</DialogTitle>
          <DialogDescription>
            Troca o PDF atual ({nomeArquivoAtual}) por outro, sem abrir renovação. O PDF
            atual fica guardado no histórico de evidências.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ea-arquivo">PDF novo</Label>
            <Input
              id="ea-arquivo"
              type="file"
              accept="application/pdf,.pdf"
              aria-invalid={!!erros.arquivo}
              aria-describedby={erros.arquivo ? "ea-arquivo-erro" : undefined}
              onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
            />
            {erros.arquivo && (
              <p id="ea-arquivo-erro" role="alert" className="text-xs text-destructive">
                {erros.arquivo}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ea-justificativa">Justificativa</Label>
            <Textarea
              id="ea-justificativa"
              rows={3}
              maxLength={2000}
              value={justificativa}
              onChange={(evento) => setJustificativa(evento.target.value)}
              aria-invalid={!!erros.justificativa}
              aria-describedby={
                erros.justificativa
                  ? "ea-justificativa-dica ea-justificativa-erro"
                  : "ea-justificativa-dica"
              }
            />
            <p id="ea-justificativa-dica" className="text-[11px] text-muted-foreground">
              Por que o PDF foi trocado. Fica registrada no histórico do documento.
            </p>
            {erros.justificativa && (
              <p id="ea-justificativa-erro" role="alert" className="text-xs text-destructive">
                {erros.justificativa}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => fechar(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => void trocar()} disabled={enviando}>
            {enviando ? "Enviando..." : "Trocar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
