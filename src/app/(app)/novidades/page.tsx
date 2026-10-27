import { ListaDeNovidades } from "@/components/novidades/ListaDeNovidades";
import { lerNovidades } from "@/lib/conteudoNovidades";
import type { Metadata } from "next";
import { TextoEmMarkdown } from "@/components/conteudo/TextoEmMarkdown";

export const metadata: Metadata = { title: "Novidades · Atlas" };

export default function NovidadesPage() {
  const novidades = lerNovidades().map(({ corpo, ...resumida }) => ({
    ...resumida,
    texto: corpo ? <TextoEmMarkdown markdown={corpo} prefixoDasAncoras={resumida.id} /> : null,
    busca: corpo,
  }));
  return <ListaDeNovidades novidades={novidades} />;
}
