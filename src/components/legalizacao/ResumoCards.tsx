import {
  AlertTriangle,
  CircleCheck,
  Clock,
  Loader,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ResumoMapa } from "@/lib/legalizacaoMapa";

type CorCard = "vencido" | "atencao" | "andamento" | "regular";

// Mesmo semáforo de cor já usado em COR_STATUS_BADGE (legalizacaoMatriz.ts)
// -- vencido=vermelho, atenção=âmbar, andamento=ciano, regular=verde.
const COR_TEXTO: Record<CorCard, string> = {
  vencido: "text-red-600",
  atencao: "text-amber-700",
  andamento: "text-cyan-700",
  regular: "text-green-600",
};

// Fundo do card inteiro tingido na cor (10%), mesmo padrão do ResumoCards de
// Gestão de Demandas (kanban/ResumoCards.tsx, "atencao" ?
// bg-[color-mix(...,var(--destructive)_10%,...)] : bg-[color-mix(...,
// var(--secondary)_10%,...)]) -- lá só existem 2 cores (atencao/normal),
// aqui são 4 (vencido/atencao/andamento/regular), então usa a opacidade do
// Tailwind puro (/10) em vez de color-mix com token, mas o efeito visual é o
// mesmo: o card inteiro "lê" como aquela cor à distância, não só o ícone.
const COR_FUNDO_CARD: Record<CorCard, string> = {
  vencido: "bg-red-600/10",
  atencao: "bg-amber-700/10",
  andamento: "bg-cyan-700/10",
  regular: "bg-green-600/10",
};

const COR_FUNDO_ICONE: Record<CorCard, string> = {
  vencido: "bg-red-600/15",
  atencao: "bg-amber-700/15",
  andamento: "bg-cyan-700/15",
  regular: "bg-green-600/15",
};

interface CardProps {
  rotulo: string;
  valor: number;
  legenda: string;
  cor: CorCard;
  Icone: LucideIcon;
}

function Card({ rotulo, valor, legenda, cor, Icone }: CardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between rounded-xl border border-border p-4 shadow-sm",
        COR_FUNDO_CARD[cor],
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {rotulo}
        </div>
        <div className={cn("mt-1 text-2xl font-bold", COR_TEXTO[cor])}>
          {valor}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
          {legenda}
        </div>
      </div>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          COR_FUNDO_ICONE[cor],
          COR_TEXTO[cor],
        )}
      >
        <Icone className="size-4" />
      </div>
    </div>
  );
}

interface ResumoCardsProps {
  resumo: ResumoMapa | undefined;
  carregando: boolean;
}

// "documento"/"unidade" concordando com o número -- achado no review
// visual: "em 1 unidades" saía errado porque o texto original do mockup
// (estático, sempre 2+) nunca precisou lidar com singular.
function plural(quantidade: number, singular: string, plural: string) {
  return quantidade === 1 ? singular : plural;
}

// Sem repetir a contagem de documentos aqui -- ela já aparece grande acima
// (stat-value), a legenda só concorda o singular/plural da palavra com
// esse número, sem reescrevê-lo.
function legendaContagem(documentos: number, unidades: number) {
  return `${plural(documentos, "documento", "documentos")}, em ${unidades} ${plural(unidades, "unidade", "unidades")}`;
}

// 4 cards fixos (não clicáveis, diferente do ResumoCards de Gestão de
// Demandas) -- espelha map-summary do mockup_matriz_legalizacao_mapa.html.
// resumo vem pronto por prop (calculado uma vez só em MapaConformidade.tsx,
// junto com a grade -- evita reprocessar a lista de documentos duas vezes).
export function ResumoCards({ resumo, carregando }: ResumoCardsProps) {
  if (carregando || !resumo) {
    return (
      <div className="grid grid-cols-2 gap-3 px-7 pt-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, indice) => (
          <Skeleton key={indice} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-7 pt-4 sm:grid-cols-4">
      <Card
        rotulo="Vencidos"
        valor={resumo.vencidos.documentos}
        legenda={legendaContagem(
          resumo.vencidos.documentos,
          resumo.vencidos.unidades,
        )}
        cor="vencido"
        Icone={AlertTriangle}
      />
      <Card
        rotulo="A vencer / Protocolado"
        valor={resumo.aVencer.documentos}
        legenda={legendaContagem(
          resumo.aVencer.documentos,
          resumo.aVencer.unidades,
        )}
        cor="atencao"
        Icone={Clock}
      />
      <Card
        rotulo="Em andamento"
        valor={resumo.emAndamento.documentos}
        legenda={legendaContagem(
          resumo.emAndamento.documentos,
          resumo.emAndamento.unidades,
        )}
        cor="andamento"
        Icone={Loader}
      />
      <Card
        rotulo="Sem pendência"
        valor={resumo.semPendencia.unidades}
        legenda={`de ${resumo.semPendencia.total} ${plural(resumo.semPendencia.total, "unidade", "unidades")}`}
        cor="regular"
        Icone={CircleCheck}
      />
    </div>
  );
}
