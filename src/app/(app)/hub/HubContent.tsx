import { ClipboardList } from "lucide-react";
import { ModuleTileAtivo, ModuleTileMutado } from "@/components/hub/ModuleTile";
import { OcorrenciasPanel, type Ocorrencia } from "@/components/hub/OcorrenciasPanel";
import { MODULOS_FUTUROS } from "@/config/modulos-futuros";

// Dados mockados — sem backend do módulo de Demandas ainda (Pacote 3).
const OCORRENCIAS: Ocorrencia[] = [
  {
    severidade: "critico",
    titulo: "3 demandas sem responsável principal",
    subtitulo: "Bloqueia avanço no Kanban — parada há mais de 2h",
    modulo: "Gestão de Demandas · Niterói",
    tempoAtras: "2h39",
  },
  {
    severidade: "critico",
    titulo: "Manutenção elétrica atrasada há 4 dias",
    subtitulo: "Prazo previsto vencido, sem justificativa registrada",
    modulo: "Gestão de Demandas · Presidente Vargas",
    responsavel: "Renata Borges",
    tempoAtras: "6h12",
  },
  {
    severidade: "atencao",
    titulo: "Demanda aguardando aprovação em revisão",
    subtitulo: "Aprovador precisa decidir para liberar conclusão",
    modulo: "Gestão de Demandas · Vitória",
    responsavel: "Felipe Claudino",
    tempoAtras: "1d",
  },
];

// Conteúdo real do Hub, preservado à parte de page.tsx (que agora só
// redireciona) -- reativar é trocar o redirect por
// `export { HubContent as default } from "./HubContent"` em page.tsx.
export function HubContent() {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 lg:p-12">
      <OcorrenciasPanel ocorrencias={OCORRENCIAS} />

      <div>
        <p className="text-xs text-muted-foreground">
          Um indicador principal por módulo — clique em um módulo ativo para abrir o
          detalhamento completo.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          <ModuleTileAtivo
            icon={ClipboardList}
            nome="Gestão de Demandas"
            descricao="Carga operacional do mês"
            href="/modulos/gestao-demandas"
            estatisticas={[
              { valor: "48", rotulo: "em andamento" },
              { valor: "14", rotulo: "atrasadas", atencao: true },
              { valor: "3", rotulo: "sem responsável", atencao: true },
            ]}
          />

          {MODULOS_FUTUROS.map((modulo) => (
            <ModuleTileMutado
              key={modulo.nome}
              icon={modulo.icon}
              nome={modulo.nome}
              descricao={modulo.descricao}
              larguras={modulo.larguras}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
