import { BookOpen, Building2, ClipboardList, FileText, Gauge, Users } from "lucide-react";
import { MiniLineChart } from "@/components/charts/MiniLineChart";
import { ModuleTileAtivo, ModuleTileMutado } from "@/components/hub/ModuleTile";

// Dados mockados — sem backend do módulo de Demandas ainda (Pacote 3).
const DEMANDAS_CONCLUIDAS_POR_MES = [22, 36, 28, 54, 45, 62, 50, 74];

export default function HubPage() {
  return (
    <div className="p-6 md:p-8 lg:p-12">
      <p className="text-xs text-muted-foreground">
        Um indicador principal por módulo — clique em um módulo ativo para abrir o detalhamento
        completo.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        <ModuleTileAtivo
          icon={ClipboardList}
          nome="Gestão de Demandas"
          descricao="Indicador-chave: demandas concluídas por mês"
          href="/modulos/gestao-demandas"
        >
          <div className="mt-2 flex flex-1 items-center gap-4">
            <div>
              <div className="text-[30px] leading-none font-extrabold tracking-tight">1.284</div>
              <div className="mt-1.5 text-[11.5px] font-bold text-[color:var(--chart-3)]">
                ▲ 12% vs. mês anterior
              </div>
            </div>
            <MiniLineChart valores={DEMANDAS_CONCLUIDAS_POR_MES} className="h-[74px] flex-1" />
          </div>
        </ModuleTileAtivo>

        <ModuleTileMutado
          icon={FileText}
          nome="Legalização"
          descricao="Documentos e conformidade por unidade."
        />

        <ModuleTileMutado
          icon={Users}
          nome="Gestão RH"
          descricao="Quadro de colaboradores por unidade."
          larguras={["60%"]}
        />

        <ModuleTileMutado
          icon={Building2}
          nome="Arquitetura"
          descricao="Projetos e obras em andamento nas unidades."
        />

        <ModuleTileMutado
          icon={BookOpen}
          nome="Diário de Bordo"
          descricao="Registro de ocorrências e passagens de plantão."
          larguras={["75%", "50%"]}
        />

        <ModuleTileMutado
          icon={Gauge}
          nome="Gestão de Calibração de Equipamentos"
          descricao="Controle de calibração e manutenção preventiva."
          larguras={["65%", "40%"]}
        />
      </div>
    </div>
  );
}
