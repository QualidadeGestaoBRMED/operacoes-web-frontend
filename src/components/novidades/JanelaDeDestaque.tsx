"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOutroDialogoAberto } from "@/hooks/useOutroDialogoAberto";
import { sessaoVerComo } from "@/lib/verComo";
import { MidiaDaNovidade } from "./EntradaDaNovidade";
import { useNovidades } from "./NovidadesProvider";

// Marca o próprio DialogContent: a janela espera outro diálogo aberto (ex.: o
// alerta persistente da Legalização) fechar, em vez de abrir por cima.
const ATRIBUTO_PROPRIO = "data-novidade-destaque";

/**
 * Grande lançamento (destaque) ainda não visto: abre sozinho, uma vez
 * (STC-877). "Ver novidade" leva à página dela, que a marca como vista;
 * "Agora não" marca na hora. Não abre nas páginas de Novidades nem no "ver
 * como".
 */
export function JanelaDeDestaque() {
  const pathname = usePathname();
  const router = useRouter();
  const { destaque, marcarComoVistas } = useNovidades();
  const [fechadaAgora, setFechadaAgora] = useState<string | null>(null);
  const existeOutroDialogo = useOutroDialogoAberto(ATRIBUTO_PROPRIO);

  const aberta =
    !!destaque &&
    fechadaAgora !== destaque.id &&
    !existeOutroDialogo &&
    !pathname.startsWith("/novidades") &&
    !sessaoVerComo();
  if (!destaque) return null;

  function fechar() {
    setFechadaAgora(destaque!.id);
    void marcarComoVistas();
  }

  return (
    <Dialog open={aberta} onOpenChange={(abrir) => !abrir && fechar()}>
      <DialogContent
        {...{ [ATRIBUTO_PROPRIO]: "" }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden />
            Novidade no Atlas
          </p>
          <DialogTitle>{destaque.titulo}</DialogTitle>
          <DialogDescription>{destaque.resumo}</DialogDescription>
        </DialogHeader>
        {destaque.imagem && <MidiaDaNovidade src={destaque.imagem} alt={destaque.titulo} alturaMaxima="max-h-[22rem]" />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={fechar}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => {
              setFechadaAgora(destaque.id);
              router.push(`/novidades/${destaque.id}`);
            }}
          >
            Ver novidade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
