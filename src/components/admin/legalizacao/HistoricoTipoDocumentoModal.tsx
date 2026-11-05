"use client";

import { History as HistoryIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useHistoricoTipoDocumento } from "@/hooks/useTiposDocumento";
import { LABEL_CATEGORIA, rotuloDaAreaResponsavel } from "@/lib/legalizacaoMatriz";
import { redesDaAbrangencia, ROTULO_ABRANGENCIA } from "@/lib/redes";
import { formatarDataHora, nomeOuRemovido } from "@/lib/utils";
import type { Rede } from "@/types";
import type { AbrangenciaTipoDocumento, HistoricoTipoDocumento } from "@/types/legalizacao";

// Rótulo amigável por campo editado -- mesmo espírito de LABEL_ACAO_HISTORICO
// em DetalheDocumentoModal.tsx, lista fechada espelhando os campos
// graváveis de TipoDocumentoRegulatorioSerializer (backend). Um campo novo
// cai no fallback abaixo (o próprio nome cru), não quebra a tela.
const LABEL_CAMPO: Record<string, string> = {
  nome: "Nome",
  codigo: "Código",
  categoria: "Categoria",
  area_responsavel: "Área responsável",
  abrangencia: "Usado em",
  setor_apoio: "Setor de apoio",
  exige_validade: "Exige validade",
  exige_protocolo: "Exige protocolo",
  exige_evidencia: "Exige evidência",
  controlado_por_profissional: "Controlado por profissional",
  permite_multiplas_instancias: "Permite múltiplas instâncias",
  ativo: "Ativo",
};

const ROTULO_CATEGORIA = LABEL_CATEGORIA as Record<string, string>;
const ROTULO_DA_ABRANGENCIA = ROTULO_ABRANGENCIA as Record<string, string>;

// valor_anterior/valor_novo em HistoricoTipoDocumento são texto cru (o
// str() do valor no backend) -- "True"/"False" pra booleano, o código do
// choice pra categoria. Traduz só quando reconhece o formato, senão mostra
// o valor como veio (mesmo raciocínio de valorHistoricoTraduzido em
// DetalheDocumentoModal.tsx).
function valorTraduzido(campo: string, valor: string, redes: Rede[]): string {
  if (valor === "True") return "Sim";
  if (valor === "False") return "Não";
  if (campo === "categoria" && ROTULO_CATEGORIA[valor]) return ROTULO_CATEGORIA[valor];
  if (campo === "abrangencia" && ROTULO_DA_ABRANGENCIA[valor]) return ROTULO_DA_ABRANGENCIA[valor];
  if (campo === "area_responsavel" && (valor === "legalizacao" || valor === "coordenacao")) {
    return rotuloDaAreaResponsavel(valor, redes);
  }
  return valor || "(vazio)";
}

function ItemHistoricoTipo({ item, redes }: { item: HistoricoTipoDocumento; redes: Rede[] }) {
  const rotuloCampo = LABEL_CAMPO[item.campo] ?? item.campo;
  return (
    <div className="relative flex gap-3.5 pb-4 last:pb-0">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary/50 bg-secondary/10 text-secondary">
        <HistoryIcon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] text-foreground">
          <strong className="font-semibold">{nomeOuRemovido(item.usuario)}</strong>{" "}
          alterou <strong className="font-semibold">{rotuloCampo.toLowerCase()}</strong>
          {item.valor_anterior && (
            <>
              {" "}
              de{" "}
              <strong>&quot;{valorTraduzido(item.campo, item.valor_anterior, redes)}&quot;</strong>
            </>
          )}
          {item.valor_novo && (
            <>
              {" "}
              para{" "}
              <strong>&quot;{valorTraduzido(item.campo, item.valor_novo, redes)}&quot;</strong>
            </>
          )}
          .
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {formatarDataHora(item.created_at)}
        </p>
      </div>
    </div>
  );
}

export function HistoricoTipoDocumentoModal({
  tipoDocumentoId,
  nome,
  abrangencia,
  onOpenChange,
}: {
  tipoDocumentoId: number | null;
  nome: string;
  /** Do tipo hoje: dá o nome da área responsável nas edições. */
  abrangencia: AbrangenciaTipoDocumento;
  onOpenChange: (open: boolean) => void;
}) {
  const aberto = tipoDocumentoId !== null;
  const redes = redesDaAbrangencia(abrangencia);
  const { historico, isLoading, mensagemErro } =
    useHistoricoTipoDocumento(tipoDocumentoId);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[75vh] max-w-[min(30rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Histórico de edições -- {nome}</DialogTitle>
        </DialogHeader>
        <div className="scrollbar-discreta flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : mensagemErro ? (
            <p className="text-sm text-destructive">
              Não foi possível carregar o histórico: {mensagemErro}
            </p>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma edição registrada ainda.
            </p>
          ) : (
            historico.map((item) => (
              <ItemHistoricoTipo key={item.id} item={item} redes={redes} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
