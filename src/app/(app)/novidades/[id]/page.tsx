import { notFound } from "next/navigation";
import { PaginaDaNovidade } from "@/components/novidades/PaginaDaNovidade";
import { lerNovidades } from "@/lib/conteudoNovidades";
import { TextoDaNovidade } from "../TextoDaNovidade";

/** /novidades/AAAA-MM-DD-NN-assunto: a página própria de uma novidade. */
export default async function NovidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encontrada = lerNovidades().find((novidade) => novidade.id === id);
  if (!encontrada) notFound();
  const { corpo, ...resumida } = encontrada;
  return (
    <PaginaDaNovidade
      novidade={{
        ...resumida,
        texto: corpo ? <TextoDaNovidade markdown={corpo} /> : null,
        busca: corpo,
      }}
    />
  );
}
