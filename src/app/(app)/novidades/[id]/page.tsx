import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDaNovidade } from "@/components/novidades/PaginaDaNovidade";
import { lerNovidades } from "@/lib/conteudoNovidades";
import { TextoDaNovidade } from "../TextoDaNovidade";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const novidade = lerNovidades().find((outra) => outra.id === id);
  return { title: novidade ? `${novidade.titulo} · Novidades · Atlas` : "Novidades · Atlas" };
}

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
        texto: corpo ? (
          <TextoDaNovidade markdown={corpo} idDaNovidade={resumida.id} comLinksDasSecoes />
        ) : null,
        busca: corpo,
      }}
    />
  );
}
