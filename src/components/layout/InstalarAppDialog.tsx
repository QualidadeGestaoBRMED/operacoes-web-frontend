"use client";

import { useState, type ComponentType, type RefObject } from "react";
import { ChevronDown, Ellipsis, EllipsisVertical, Menu, Share, SquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

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

export type Navegador =
  | "safari-ios"
  | "chrome-ios"
  | "chrome-android"
  | "samsung"
  | "edge-android"
  | "firefox-android";

/** Navegador do celular, ou "computador"/"outro" quando não há instrução própria. */
export type NavegadorIdentificado = Navegador | "computador" | "outro";

/**
 * Pelo user agent. O iPad com iPadOS se apresenta como Mac; o toque é o que
 * o distingue de um Mac de verdade. Os navegadores do Android e do iPhone se
 * identificam por um termo próprio (SamsungBrowser, EdgA, CriOS...) além do
 * "Chrome"/"Safari" que todos carregam, então a ordem dos testes importa.
 */
export function identificarNavegador(
  userAgent: string,
  pontosDeToque = 0,
): NavegadorIdentificado {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && pontosDeToque > 1);
  if (ios) {
    if (/CriOS/.test(userAgent)) return "chrome-ios";
    if (/FxiOS|EdgiOS|OPiOS/.test(userAgent)) return "outro";
    return "safari-ios";
  }
  if (/Android/.test(userAgent)) {
    if (/SamsungBrowser/.test(userAgent)) return "samsung";
    if (/EdgA/.test(userAgent)) return "edge-android";
    if (/Firefox/.test(userAgent)) return "firefox-android";
    if (/OPR|Opera|UCBrowser|YaBrowser|MiuiBrowser/.test(userAgent)) return "outro";
    if (/Chrome/.test(userAgent)) return "chrome-android";
    return "outro";
  }
  return "computador";
}

const INSTRUCOES: Record<Navegador, { aparelho: string; navegador: string; passos: Passo[] }> = {
  "safari-ios": {
    aparelho: "iPhone e iPad",
    navegador: "Safari",
    passos: [
      {
        texto: "Toque em Compartilhar. Em alguns aparelhos, ele fica dentro do botão ••• da barra.",
        icone: Share,
      },
      { texto: "Toque em \"Adicionar à Tela de Início\".", icone: SquarePlus },
      { texto: "Toque em \"Adicionar\"." },
    ],
  },
  "chrome-ios": {
    aparelho: "iPhone e iPad",
    navegador: "Chrome",
    passos: [
      { texto: "Toque em Compartilhar, na barra de endereço.", icone: Share },
      { texto: "Toque em \"Adicionar à Tela de Início\".", icone: SquarePlus },
      { texto: "Toque em \"Adicionar\"." },
    ],
  },
  "chrome-android": {
    aparelho: "Android",
    navegador: "Chrome",
    passos: [
      { texto: "Toque no menu, os três pontos no canto da tela.", icone: EllipsisVertical },
      { texto: "Toque em \"Instalar app\" (ou \"Adicionar à tela inicial\")." },
      { texto: "Confirme em \"Instalar\"." },
    ],
  },
  samsung: {
    aparelho: "Android",
    navegador: "Samsung Internet",
    passos: [
      { texto: "Toque no menu, as três linhas na barra de baixo.", icone: Menu },
      { texto: "Toque em \"Adicionar página a\"." },
      { texto: "Toque em \"Tela inicial\" e confirme." },
    ],
  },
  "edge-android": {
    aparelho: "Android",
    navegador: "Edge",
    passos: [
      { texto: "Toque no menu, os três pontos na barra de baixo.", icone: Ellipsis },
      { texto: "Toque em \"Adicionar ao telefone\"." },
      { texto: "Confirme em \"Instalar\"." },
    ],
  },
  "firefox-android": {
    aparelho: "Android",
    navegador: "Firefox",
    passos: [
      { texto: "Toque no menu, os três pontos no canto da tela.", icone: EllipsisVertical },
      { texto: "Toque em \"Instalar\" (ou \"Adicionar à tela inicial\")." },
      { texto: "Confirme em \"Adicionar\"." },
    ],
  },
};

const ORDEM: Navegador[] = [
  "safari-ios",
  "chrome-android",
  "samsung",
  "chrome-ios",
  "edge-android",
  "firefox-android",
];
// No computador (quem quer instalar no celular) e em navegador sem instrução
// própria: os dois mais comuns na frente, os demais em "Usa outro navegador?".
const MAIS_COMUNS: Navegador[] = ["safari-ios", "chrome-android"];

function BlocoDePassos({ chave }: { chave: Navegador }) {
  const { aparelho, navegador, passos } = INSTRUCOES[chave];
  return (
    <section aria-labelledby={`instalar-${chave}`} className="space-y-2">
      <h3 id={`instalar-${chave}`} className="text-sm font-semibold">
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
  );
}

/**
 * Só monta com a janela aberta: lê o navegador no cliente, e "Usa outro
 * navegador?" volta fechado na próxima abertura.
 */
function Instrucoes() {
  const [outrosAbertos, setOutrosAbertos] = useState(false);
  const identificado = identificarNavegador(navigator.userAgent, navigator.maxTouchPoints);
  const principais =
    identificado === "computador" || identificado === "outro" ? MAIS_COMUNS : [identificado];
  const outros = ORDEM.filter((chave) => !principais.includes(chave));

  return (
    <>
      {identificado === "outro" && (
        <p className="text-sm">
          Procure no menu do seu navegador a opção &quot;Instalar&quot; ou &quot;Adicionar à tela
          inicial&quot;. Nos navegadores mais comuns:
        </p>
      )}
      {principais.map((chave) => (
        <BlocoDePassos key={chave} chave={chave} />
      ))}
      <div className="space-y-4 border-t pt-3">
        <button
          type="button"
          aria-expanded={outrosAbertos}
          onClick={() => setOutrosAbertos((aberto) => !aberto)}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Usa outro navegador?
          <ChevronDown className={cn("size-4 transition-transform", outrosAbertos && "rotate-180")} />
        </button>
        {outrosAbertos && (
          <>
            {outros.map((chave) => (
              <BlocoDePassos key={chave} chave={chave} />
            ))}
            <p className="text-sm text-muted-foreground">
              Em qualquer outro, procure no menu a opção &quot;Instalar&quot; ou &quot;Adicionar à
              tela inicial&quot;.
            </p>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Passos para instalar o Atlas como app (STC-830). No Android o Chrome
 * oferece a instalação sozinho; no iPhone o Safari não oferece nada, e o
 * caminho pelo Compartilhar não é conhecido. O Safari não consegue saber se
 * o app já está instalado, então as instruções ficam num item fixo do menu
 * em vez de um aviso automático. No celular, mostra os passos do navegador
 * em uso; os demais ficam em "Usa outro navegador?".
 */
export function InstalarAppDialog({
  aberto,
  onOpenChange,
  focoAoFechar,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Botão do menu que abriu a janela: o item clicado já não existe ao fechar. */
  focoAoFechar: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onCloseAutoFocus={(evento) => {
          evento.preventDefault();
          focoAoFechar.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Instalar o Atlas no celular</DialogTitle>
          <DialogDescription>
            Com o Atlas na tela de início, ele abre como um aplicativo, em tela cheia.
          </DialogDescription>
        </DialogHeader>
        <Instrucoes />
      </DialogContent>
    </Dialog>
  );
}
