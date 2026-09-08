"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function BlocoCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copiar}
        aria-label="Copiar código"
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-primary-foreground/60 outline-none transition-colors hover:bg-white/10 hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-white/40"
      >
        {copiado ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <pre className="scrollbar-discreta overflow-x-auto rounded-lg bg-black/20 p-4 pr-10 font-mono text-[12.5px] leading-relaxed text-primary-foreground/90">
        <code>{codigo}</code>
      </pre>
    </div>
  );
}
