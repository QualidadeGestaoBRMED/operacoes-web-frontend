import { ListaDeNovidades } from "@/components/novidades/ListaDeNovidades";
import { lerNovidades } from "@/lib/conteudoNovidades";
import { TextoDaNovidade } from "./TextoDaNovidade";

export default function NovidadesPage() {
  const novidades = lerNovidades().map(({ corpo, ...resumida }) => ({
    ...resumida,
    texto: corpo ? <TextoDaNovidade markdown={corpo} /> : null,
    busca: corpo,
  }));
  return <ListaDeNovidades novidades={novidades} />;
}
