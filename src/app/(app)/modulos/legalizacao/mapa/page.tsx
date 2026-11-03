import { MapaConformidade } from "@/components/legalizacao/MapaConformidade";
import { SoParaQuemVeTudo } from "@/components/legalizacao/SoParaQuemVeTudo";

export default function LegalizacaoMapaPage() {
  return (
    <SoParaQuemVeTudo>
      <MapaConformidade />
    </SoParaQuemVeTudo>
  );
}
