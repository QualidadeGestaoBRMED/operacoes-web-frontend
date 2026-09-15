"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { agruparAlertasPorDocumento, LABEL_CRITICIDADE, numeroDaUrl } from "@/lib/legalizacaoMatriz";
import { cn, formatarTempoRelativo } from "@/lib/utils";

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
const ROTA_MATRIZ = "/modulos/legalizacao";

export function AlertaPersistenteModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { alertas, error } = useAlertasPendentes();
  const [dispensado, setDispensado] = useState(false);

  // Achado em code review (3ª rodada): este modal é montado fora de
  // qualquer rota (AppShell.tsx) e não sabia nada sobre
  // DetalheDocumentoModal (aberto via ?documento= na URL, lido por
  // MatrizConformidade.tsx) -- um usuário chegando direto em
  // /modulos/legalizacao?documento=57 (link salvo/compartilhado) com algum
  // alerta pendente via os DOIS diálogos abertos ao mesmo tempo, empilhados.
  // Suprime a abertura enquanto houver um documento ativo na URL; assim que
  // ele fechar (MatrizConformidade limpa o parâmetro), o alerta persistente
  // volta a aparecer normalmente, se ainda houver pendência.
  const temDocumentoAtivoNaUrl = numeroDaUrl(searchParams.get("documento")) !== undefined;

  // Um novo alerta chegando (poll de 60s) depois do usuário já ter
  // dispensado nesta sessão deve voltar a interromper -- "permanece
  // visível... até a resolução" vale pra cada alerta, não só pro conjunto
  // que existia quando a aba abriu.
  //
  // Achado em code review: comparar só a CONTAGEM ("> 0"/"> anterior")
  // reabria em qualquer mudança de total, inclusive uma queda (alerta
  // resolvido), e também deixava passar batido o caso de um alerta ser
  // resolvido e outro surgir no mesmo ciclo de poll -- a contagem ficava
  // igual, o alerta novo nunca reabria o modal. Comparando o CONJUNTO de
  // ids (não só o tamanho) resolve os dois: só reabre quando aparece um id
  // que não existia no último conjunto visto. idsPendentes (string
  // derivada, estável entre polls sem mudança de conteúdo) é a dependência
  // do efeito -- alertas.length/alertas em si mudam de referência a cada
  // poll mesmo sem mudança real, o que reabriria o modal à toa.
  const totalPendentes = alertas.length;
  const idsPendentes = alertas
    .map((a) => a.id)
    .sort((a, b) => a - b)
    .join(",");
  const idsAnterioresRef = useRef<Set<number>>(new Set());
  const tinhaErroRef = useRef(Boolean(error));
  useEffect(() => {
    const idsAtuais = new Set(alertas.map((a) => a.id));
    const surgiuIdNovo = [...idsAtuais].some((id) => !idsAnterioresRef.current.has(id));
    // Achado em code review (2ª rodada): uma falha de rede virava "sem
    // alerta" pro modal (useAlertasPendentes já loga, mas isso não é
    // visível pra quem usa a plataforma) -- justo o cenário que RN22 existe
    // pra cobrir, "está tudo em dia" e "não consegui checar" não podem
    // parecer a mesma coisa. Erro também reabre se começou a falhar depois
    // de já dispensado (mesma lógica de "info nova", não só alerta novo).
    const erroComecouAgora = Boolean(error) && !tinhaErroRef.current;
    if (surgiuIdNovo || erroComecouAgora) setDispensado(false);
    idsAnterioresRef.current = idsAtuais;
    tinhaErroRef.current = Boolean(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsPendentes já resume `alertas`.
  }, [idsPendentes, error]);

  const aberto =
    (totalPendentes > 0 || Boolean(error)) && !dispensado && !temDocumentoAtivoNaUrl;

  function abrirDocumento(documentoId: number) {
    setDispensado(true);
    // Achado em code review: sobrescrever a querystring inteira perdia
    // filtro ativo (ex. ?unidade=5) se o usuário já estivesse na própria
    // Matriz quando o alerta apareceu (poll de 60s, modal montado fora de
    // qualquer rota). Só mescla os parâmetros existentes quando já estamos
    // na Matriz -- vindo de outra tela, os parâmetros dela não têm nada a
    // ver com o destino, começa do zero. Mesmo padrão de abrirDetalhe()
    // (MatrizConformidade.tsx).
    const params =
      pathname === ROTA_MATRIZ ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    params.set("documento", String(documentoId));
    router.push(`${ROTA_MATRIZ}?${params.toString()}`);
  }

  // Achado no feedback visual: um mesmo documento pode ter mais de um
  // AlertaRegulatorio pendente (ex. imediato de movimentação profissional +
  // de ciclo da varredura diária, os dois legítimos enquanto o documento
  // não é resolvido) -- contar/listar por ALERTA fazia "CNES" aparecer 2x,
  // e o título dizia "4 alertas" quando só 3 documentos precisavam de
  // atenção de verdade. Agrupa por documento (agruparAlertasPorDocumento,
  // legalizacaoMatriz.ts) -- a contagem e a lista passam a refletir quantos
  // DOCUMENTOS têm pendência, não quantos registros de alerta existem.
  const documentosAgrupados = agruparAlertasPorDocumento(alertas);
  const totalDocumentos = documentosAgrupados.length;

  // totalPendentes = 0 aqui só é alcançável com erro (aberto exige um dos
  // dois) -- nunca conseguimos checar, então não dá pra dizer "está tudo em
  // dia" nem mostrar uma lista (não existe lista nenhuma, com ou sem cache
  // -- SWR mantém o último `data` bom, então se já tinha alerta antes, ele
  // continua aparecendo abaixo mesmo com erro agora).
  const falhaSemNenhumDadoAnterior = totalPendentes === 0 && Boolean(error);

  return (
    <Dialog open={aberto} onOpenChange={() => setDispensado(true)}>
      <DialogContent className="max-h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {falhaSemNenhumDadoAnterior
              ? "Não foi possível verificar alertas pendentes"
              : totalDocumentos === 1
                ? "1 documento regulatório pendente"
                : `${totalDocumentos} documentos regulatórios pendentes`}
          </DialogTitle>
          <DialogDescription>
            {falhaSemNenhumDadoAnterior
              ? "A checagem falhou agora -- pode haver alertas pendentes sem aparecer aqui. Tente de novo em instantes."
              : "Documentos entrando na janela de renovação que ainda não tiveram nenhuma ação."}
          </DialogDescription>
        </DialogHeader>

        {error && !falhaSemNenhumDadoAnterior && (
          <p className="-mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Não foi possível atualizar esta lista agora -- pode haver mudanças recentes (alertas
            novos ou já resolvidos) ainda não refletidas abaixo.
          </p>
        )}

        <div className="scrollbar-discreta -mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
          {documentosAgrupados.map((grupo) => (
            <button
              key={grupo.documentoId}
              type="button"
              onClick={() => abrirDocumento(grupo.documentoId)}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {grupo.tipoDocumentoNome}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {grupo.unidadeNome} · gerado {formatarTempoRelativo(grupo.dataMaisAntiga)}
                  {grupo.totalAlertas > 1 && ` · ${grupo.totalAlertas} alertas`}
                </p>
              </div>
              {grupo.criticidade && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                    grupo.criticidade === "alta"
                      ? "border-red-200 bg-red-100 text-red-700"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {LABEL_CRITICIDADE[grupo.criticidade]}
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
