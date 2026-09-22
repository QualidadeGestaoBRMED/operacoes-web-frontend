"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { agruparAlertasPorDocumento, numeroDaUrl } from "@/lib/legalizacaoMatriz";
import { formatarTempoRelativo } from "@/lib/utils";

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

// Marca o próprio DialogContent (abaixo) pra distinguir "outro diálogo
// aberto" do diálogo do próprio alerta persistente na varredura do DOM.
const ATRIBUTO_PROPRIO = "data-alerta-persistente-modal";
const SELETOR_QUALQUER_DIALOGO_ABERTO =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

// useLayoutEffect (não useEffect): roda antes do navegador pintar -- sem
// isso, o estado inicial otimista (useState(false), "nenhum outro diálogo
// aberto") deixaria o 1º frame abrir por cima de um diálogo que já estava
// lá antes de checar de verdade. Isomorfo só pra evitar o warning do React
// em SSR (mesmo padrão de useMediaQuery.ts/useAlturaSemLinhaCortada.ts).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Achado em code review: a supressão existente (temDocumentoAtivoNaUrl,
// abaixo) só cobre a colisão com DetalheDocumentoModal (via ?documento= na
// URL) -- mas o alerta persistente é montado fora de qualquer rota
// (AppShell.tsx) exatamente pra poder interromper em qualquer lugar da
// plataforma, então também pode reabrir (poll de 60s trazendo alerta novo,
// ou começando a falhar) por cima de QUALQUER outro <Dialog>/<AlertDialog>
// já aberto -- um formulário (FormNovaDemanda.tsx), um ConfirmDialog, etc.
// Dois diálogos do Radix montados ao mesmo tempo disputam foco/Tab/Escape
// entre si, não é só sobreposição visual. MutationObserver (não só checar
// uma vez) pra reagir tanto a um diálogo abrindo quanto a ele fechando --
// sem isso, o alerta só voltaria a aparecer no próximo poll (até 60s
// depois do outro diálogo já ter fechado).
function useExisteOutroDialogoAberto(): boolean {
  const [existeOutro, setExisteOutro] = useState(false);

  useIsomorphicLayoutEffect(() => {
    function checar() {
      const abertos = document.querySelectorAll(SELETOR_QUALQUER_DIALOGO_ABERTO);
      setExisteOutro(Array.from(abertos).some((el) => !el.hasAttribute(ATRIBUTO_PROPRIO)));
    }
    checar();
    const observer = new MutationObserver(checar);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-state", "role"],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  return existeOutro;
}

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
  const existeOutroDialogoAberto = useExisteOutroDialogoAberto();

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
    (totalPendentes > 0 || Boolean(error)) &&
    !dispensado &&
    !temDocumentoAtivoNaUrl &&
    !existeOutroDialogoAberto;

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
      <DialogContent
        {...{ [ATRIBUTO_PROPRIO]: "" }}
        // sm:max-w-2xl (não o max-w-lg padrão do Dialog) -- pedido do Tech
        // Lead depois de ver o modal em uso real (Gestão de Demandas):
        // ficava estreito pra uma lista com "· N alertas" ao lado do nome
        // do documento, texto cortando com facilidade. Um 1º
        // aumento pra sm:max-w-xl passou despercebido (diferença pequena
        // demais, 512px -> 576px) -- pulando direto pra 2xl (672px). gap-6
        // (não o gap-4 padrão) e o conteúdo de cada linha (abaixo) maiores --
        // mesmo pedido, o modal ficava alto o bastante pra largura nova.
        className="max-h-[85vh] flex flex-col gap-6 sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-6 text-destructive" />
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

        {
          // Pedido: no desktop, a lista não deve crescer indefinidamente até
          // os 85vh do Dialog (o normal seria caber uns 6-7 documentos numa
          // tela comum) -- trava em 5 linhas, o resto rola. 438px medido de
          // verdade (Playwright, viewport 1440x1200): cada card tem 78px de
          // altura (p-4 + as duas linhas de texto + borda) e o gap entre
          // eles é 12px -- 5*78 + 4*12 = 438. Só a partir de sm: -- no
          // celular a tela já é curta o bastante pra o cap de 85vh do
          // próprio Dialog (acima) ser a régua certa; um valor fixo em px
          // ali só arriscaria sobrar espaço vazio ou não caber, dependendo
          // do aparelho.
        }
        <div className="scrollbar-discreta -mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 sm:max-h-[438px]">
          {documentosAgrupados.map((grupo) => (
            <button
              key={grupo.documentoId}
              type="button"
              onClick={() => abrirDocumento(grupo.documentoId)}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-foreground">
                  {grupo.tipoDocumentoNome}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {grupo.unidadeNome} · gerado {formatarTempoRelativo(grupo.dataMaisAntiga)}
                  {grupo.totalAlertas > 1 && ` · ${grupo.totalAlertas} alertas`}
                </p>
              </div>
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
