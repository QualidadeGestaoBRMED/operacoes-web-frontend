import { ListaDeNovidades } from "@/components/novidades/ListaDeNovidades";
import { lerNovidades } from "@/lib/conteudoNovidades";
import type { Metadata } from "next";
import { TextoDaNovidade } from "./TextoDaNovidade";

export const metadata: Metadata = { title: "Novidades · Atlas" };

export default function NovidadesPage() {
  const novidades = lerNovidades().map(({ corpo, ...resumida }) => ({
    ...resumida,
    texto: corpo ? <TextoDaNovidade markdown={corpo} idDaNovidade={resumida.id} /> : null,
    busca: corpo,
  }));
  return <ListaDeNovidades novidades={novidades} />;
}
