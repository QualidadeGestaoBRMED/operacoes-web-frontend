"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAlertasPendentes } from "@/hooks/useAlertasPendentes";
import { LABEL_CRITICIDADE } from "@/lib/legalizacaoMatriz";
import { cn, formatarTempoRelativo } from "@/lib/utils";
import type { AlertaRegulatorio } from "@/types/legalizacao";

// STC-443 (RN22, MP002): "o alerta permanece visível na plataforma até a
// resolução" -- STC-373 só cobriu o aviso avulso e dispensável (sino do
// Topbar); isto cobre a persistência, mostrando de novo a cada sessão
// (nunca gravado em localStorage/backend) enquanto existir pelo menos um
// AlertaRegulatorio com status_tratamento="pendente" visível pro usuário
// (responsável do documento ou Coordenação da Unidade -- RBAC já resolvido
// por useAlertasPendentes()/AlertaRegulatorioViewSet). Fechar só dispensa
// pra esta sessão -- não marca nada como tratado no backend (só a ação real
// no documento, fora deste modal, faz isso), então reabrir a aba ou
// recarregar a página mostra de novo se ainda houver pendência.
//
// Montado uma vez em AppShell.tsx, não por tela -- dispara em qualquer
// lugar da plataforma, não só nas telas de Legalização.
export function AlertaPersistenteModal() {
  const router = useRouter();
  const { alertas } = useAlertasPendentes();
  const [dispensado, setDispensado] = useState(false);

  // Um novo alerta chegando (poll de 60s) depois do usuário já ter
  // dispensado nesta sessão deve voltar a interromper -- "permanece
  // visível... até a resolução" vale pra cada alerta, não só pro conjunto
  // que existia quando a aba abriu. Contagem (não a lista inteira) como
  // dependência -- referência de array novo a cada poll (mesmo objeto,
  // ainda sem mudança de conteúdo) não pode reabrir o modal à toa.
  //
  // Achado em code review: comparar só "> 0" reabria em QUALQUER mudança,
  // inclusive uma queda -- um alerta sendo resolvido (ex.: o próprio usuário
  // clicou aqui, foi lá e tratou) fazia o modal pipocar de novo assim que o
  // próximo poll refletisse a contagem menor, bem na hora em que o usuário
  // tinha acabado de fazer o que era pedido. useRef guarda a última
  // contagem vista pra só reabrir quando ela de fato SOBE.
  const totalPendentes = alertas.length;
  const totalAnteriorRef = useRef(totalPendentes);
  useEffect(() => {
    if (totalPendentes > totalAnteriorRef.current) setDispensado(false);
    totalAnteriorRef.current = totalPendentes;
  }, [totalPendentes]);

  const aberto = totalPendentes > 0 && !dispensado;

  function abrirDocumento(alerta: AlertaRegulatorio) {
    setDispensado(true);
    router.push(`/modulos/legalizacao?documento=${alerta.documento_unidade.id}`);
  }

  return (
    <Dialog open={aberto} onOpenChange={() => setDispensado(true)}>
      <DialogContent className="max-h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {totalPendentes === 1
              ? "1 alerta regulatório pendente"
              : `${totalPendentes} alertas regulatórios pendentes`}
          </DialogTitle>
          <DialogDescription>
            Documentos entrando na janela de renovação que ainda não tiveram nenhuma ação.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-discreta -mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
          {alertas.map((alerta) => (
            <button
              key={alerta.id}
              type="button"
              onClick={() => abrirDocumento(alerta)}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {alerta.documento_unidade.tipo_documento.nome}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {alerta.documento_unidade.unidade.nome} · gerado{" "}
                  {formatarTempoRelativo(alerta.data_geracao)}
                </p>
              </div>
              {alerta.criticidade && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                    alerta.criticidade === "alta"
                      ? "border-red-200 bg-red-100 text-red-700"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {LABEL_CRITICIDADE[alerta.criticidade]}
                </span>
              )}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDispensado(true)}>
            Ver depois
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
