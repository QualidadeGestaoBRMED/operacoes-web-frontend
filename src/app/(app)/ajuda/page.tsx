import type { Metadata } from "next";
import { ListaDaAjuda } from "@/components/ajuda/ListaDaAjuda";
import { lerArtigos } from "@/lib/conteudoAjuda";

export const metadata: Metadata = { title: "Ajuda · Atlas" };

export default function AjudaPage() {
  const artigos = lerArtigos().map(({ corpo, ...resumido }) => ({ ...resumido, busca: corpo }));
  return <ListaDaAjuda artigos={artigos} />;
}
