import { ClipboardList, FileText, Globe, Package, Users } from "lucide-react";
import { MiniLineChart } from "@/components/charts/MiniLineChart";
import { ModuleTileAtivo, ModuleTileMutado, ModuleTileVazio } from "@/components/hub/ModuleTile";

// Dados mockados — sem backend do módulo de Demandas ainda (Pacote 3).
const DEMANDAS_CONCLUIDAS_POR_MES = [22, 36, 28, 54, 45, 62, 50, 74];

export default function HubPage() {
  return (
    <div className="p-6 md:p-8 lg:p-12">
      <p className="text-xs text-muted-foreground">
        Um indicador principal por módulo — o tamanho do card reflete a importância. Clique em um
        módulo ativo para abrir o detalhamento completo.
      </p>

      <div
        className="mt-4 grid gap-[18px]"
        style={{
          gridTemplateColumns: "1fr 1fr 0.95fr",
          gridTemplateRows: "196px 172px 172px",
          gridTemplateAreas: `"demandas demandas legalizacao" "rh vazio estoque" "live live estoque"`,
        }}
      >
        <ModuleTileAtivo
          className="[grid-area:demandas]"
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
            <MiniLineChart
              valores={DEMANDAS_CONCLUIDAS_POR_MES}
              className="h-[74px] flex-1"
            />
          </div>
        </ModuleTileAtivo>

        <ModuleTileMutado
          className="[grid-area:legalizacao]"
          icon={FileText}
          nome="Legalização"
          descricao="Documentos e conformidade por unidade."
        />

        <ModuleTileMutado
          className="[grid-area:rh]"
          icon={Users}
          nome="Gestão RH"
          descricao="Quadro de colaboradores por unidade."
          larguras={["60%"]}
        />

        <ModuleTileVazio className="[grid-area:vazio]" />

        <ModuleTileMutado
          className="[grid-area:estoque]"
          icon={Package}
          nome="Gestão de Estoque"
          descricao="Controle de insumos e materiais entre unidades."
          larguras={["80%", "55%", "65%", "40%"]}
        />

        <ModuleTileMutado
          className="[grid-area:live]"
          icon={Globe}
          nome="Live 360"
          descricao="Visão consolidada em tempo real de todas as unidades."
          larguras={["92%"]}
        />
      </div>
    </div>
  );
}
