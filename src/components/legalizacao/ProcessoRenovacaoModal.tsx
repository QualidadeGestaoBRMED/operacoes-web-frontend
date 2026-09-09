"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCriarProcessoRenovacao } from "@/hooks/useProcessoRenovacao";
import { extrairMensagemErro } from "@/lib/erros";
import { formatarDataHora } from "@/lib/utils";
import type { DocumentoUnidade } from "@/types/legalizacao";

// Ponto de entrada da STC-381 (mockup_processo_renovacao_legalizacao.html) --
// "Registrar renovação" (Detalhe do Documento, STC-380) precisa abrir ESTE
// modal, não só disparar o POST direto (achado em code review: sem um modal
// aqui, a STC-381 não teria onde abrir as seções de Protocolo/Conclusão).
// Por enquanto só a seção "1. Solicitação" existe de verdade -- é o que a
// criação do processo (RF-009: o POST já é o "iniciar") realmente produz;
// Protocolo/Conclusão chegam na STC-381, estendendo este mesmo componente.
export function ProcessoRenovacaoModal({
  documento,
  aberto,
  onOpenChange,
  onRegistrado,
}: {
  documento: DocumentoUnidade | null;
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistrado: () => void;
}) {
  const [concluidoEm, setConcluidoEm] = useState<string | null>(null);
  const { criar, isLoading } = useCriarProcessoRenovacao();

  function fechar() {
    setConcluidoEm(null);
    onOpenChange(false);
  }

  async function confirmar() {
    if (!documento) return;
    try {
      const processo = await criar({ documento_unidade: documento.id });
      setConcluidoEm(processo.created_at);
      onRegistrado();
      toast.success("Processo de renovação iniciado.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Processo de Renovação</DialogTitle>
          {documento && (
            <p className="text-[12.5px] text-muted-foreground">
              {documento.tipo_documento.nome} · {documento.unidade.nome}
            </p>
          )}
        </DialogHeader>

        {concluidoEm ? (
          <>
            <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 p-3">
              <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                1. Solicitação · concluída
              </span>
              <span className="text-sm text-foreground">
                Concluída em {formatarDataHora(concluidoEm)}.
              </span>
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              Protocolo e conclusão da renovação chegam numa próxima etapa.
            </p>
            <DialogFooter>
              <Button onClick={fechar}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground">
              Isso inicia o processo de renovação e move o documento para
              &quot;Em andamento&quot;.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={fechar} disabled={isLoading}>
                Cancelar
              </Button>
              <Button disabled={isLoading} onClick={() => void confirmar()}>
                {isLoading ? "Iniciando..." : "Iniciar processo de renovação"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
