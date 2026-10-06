"use client";

import { CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useColaboradorRH } from "@/hooks/useFeriasGestaoRH";
import { formatarDataISO } from "@/lib/gestaoRH";
import { hojeISO } from "@/lib/utils";
import { AbaFerias } from "./AbaFerias";

function CampoMeta({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </span>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

interface DetalheColaboradorModalProps {
  colaboradorId: number | null;
  periodoEmFoco: number | null;
  onFechar: () => void;
}

/**
 * Modal único do colaborador (Gestão RH), aberto pela URL. Cabeçalho e
 * dados do colaborador ficam na coluna da esquerda; cada pilar é uma aba
 * que só carrega quando aberta. Mesma estrutura do detalhe do documento da
 * Legalização.
 */
export function DetalheColaboradorModal({
  colaboradorId,
  periodoEmFoco,
  onFechar,
}: DetalheColaboradorModalProps) {
  const { colaborador, isLoading, mensagemErro } = useColaboradorRH(colaboradorId);
  const alertasFerias = colaborador?.alertas_pendentes.ferias ?? 0;

  return (
    <Dialog open={colaboradorId !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent
        showCloseButton
        className="flex max-h-[88vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        {isLoading || (!colaborador && !mensagemErro) ? (
          <div className="flex flex-1 flex-col gap-4 p-6">
            <DialogTitle className="sr-only">Carregando colaborador</DialogTitle>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
        ) : !colaborador ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
            <DialogTitle className="sr-only">Colaborador</DialogTitle>
            Não foi possível carregar o colaborador: {mensagemErro}
          </div>
        ) : (
          <>
            <DialogHeader className="gap-1.5 border-b border-border px-6 py-4">
              <DialogTitle className="text-[17px] leading-snug font-semibold text-foreground">
                {colaborador.nome}
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                {[colaborador.cargo, colaborador.unidade.nome].filter(Boolean).join(" · ")}
              </DialogDescription>
              {!colaborador.ativo && (
                <span className="w-fit rounded-full bg-slate-500 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                  Desligado
                </span>
              )}
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:grid sm:grid-cols-[230px_1fr]">
              <div className="scrollbar-discreta flex max-h-[30vh] shrink-0 flex-col gap-4 overflow-y-auto border-b border-border p-4.5 sm:max-h-none sm:shrink sm:border-r sm:border-b-0">
                <CampoMeta rotulo="Unidade">{colaborador.unidade.nome}</CampoMeta>
                {colaborador.cargo && <CampoMeta rotulo="Cargo">{colaborador.cargo}</CampoMeta>}
                <CampoMeta rotulo="Matrícula">{colaborador.matricula_vr}</CampoMeta>
                <CampoMeta rotulo="Admissão">
                  {colaborador.data_admissao ? formatarDataISO(colaborador.data_admissao) : "Não informada"}
                </CampoMeta>
              </div>

              <Tabs defaultValue="ferias" className="min-h-0 min-w-0 flex-1 gap-0">
                <TabsList
                  variant="line"
                  className="h-11 w-full justify-start gap-4 rounded-none border-b border-border bg-transparent px-5"
                >
                  <TabsTrigger
                    value="ferias"
                    className="flex-none gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                  >
                    <CalendarDays aria-hidden className="size-3.5" />
                    Férias
                    {alertasFerias > 0 && (
                      <span className="rounded-full bg-amber-600/15 px-1.5 py-px text-[10.5px] font-bold text-amber-700">
                        {alertasFerias} {alertasFerias === 1 ? "alerta" : "alertas"}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="ferias" className="scrollbar-discreta flex-1 overflow-y-auto p-5">
                  <AbaFerias
                    colaboradorId={colaborador.id}
                    ativo={colaborador.ativo}
                    periodoEmFoco={periodoEmFoco}
                    hoje={hojeISO()}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
