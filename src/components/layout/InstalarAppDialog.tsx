"use client";

import type { ComponentType } from "react";
import { EllipsisVertical, Share, SquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Atlas aberto como app instalado (STC-786). O Safari do iPhone antigo só
 * informa por navigator.standalone; os demais, pela media query.
 */
export function useAppInstalado(): boolean {
  const pelaMediaQuery = useMediaQuery("(display-mode: standalone)");
  const peloSafari =
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return pelaMediaQuery || peloSafari;
}

interface Passo {
  texto: string;
  icone?: ComponentType<{ className?: string }>;
}

const PASSOS: { aparelho: string; navegador: string; passos: Passo[] }[] = [
  {
    aparelho: "iPhone",
    navegador: "Safari",
    passos: [
      {
        texto: "Toque em Compartilhar. Em alguns iPhones, ele fica dentro do botão ••• da barra.",
        icone: Share,
      },
      { texto: "Toque em \"Adicionar à Tela de Início\".", icone: SquarePlus },
      { texto: "Toque em \"Adicionar\"." },
    ],
  },
  {
    aparelho: "Android",
    navegador: "Chrome",
    passos: [
      { texto: "Toque no menu, os três pontos no canto da tela.", icone: EllipsisVertical },
      { texto: "Toque em \"Instalar app\" (ou \"Adicionar à tela inicial\")." },
      { texto: "Confirme em \"Instalar\"." },
    ],
  },
];

/**
 * Passos para instalar o Atlas como app (STC-830). No Android o Chrome
 * oferece a instalação sozinho; no iPhone o Safari não oferece nada, e o
 * caminho pelo Compartilhar não é conhecido. O Safari não consegue saber se
 * o app já está instalado, então as instruções ficam num item fixo do menu
 * em vez de um aviso automático.
 */
export function InstalarAppDialog({
  aberto,
  onOpenChange,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Instalar o Atlas no celular</DialogTitle>
          <DialogDescription>
            Com o Atlas na tela de início, ele abre como um aplicativo, em tela cheia.
          </DialogDescription>
        </DialogHeader>
        {PASSOS.map(({ aparelho, navegador, passos }) => (
          <section key={aparelho} aria-labelledby={`instalar-${aparelho}`} className="space-y-2">
            <h3 id={`instalar-${aparelho}`} className="text-sm font-semibold">
              {aparelho} <span className="font-normal text-muted-foreground">· pelo {navegador}</span>
            </h3>
            <ol className="space-y-2">
              {passos.map(({ texto, icone: Icone }, indice) => (
                <li key={texto} className="flex items-start gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {indice + 1}
                  </span>
                  <span className="flex-1 pt-0.5">{texto}</span>
                  {Icone && (
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-md border text-primary"
                    >
                      <Icone className="size-4" />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
