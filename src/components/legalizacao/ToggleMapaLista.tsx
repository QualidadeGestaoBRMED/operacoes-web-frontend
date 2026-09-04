import Link from "next/link";
import { cn } from "@/lib/utils";

interface ToggleMapaListaProps {
  ativo: "mapa" | "lista";
  // Opcional, só o Mapa passa (STC-379) -- achado no review visual: sem
  // nenhuma explicação na tela, não fica óbvio que a célula é clicável nem
  // o que ela representa (unidade × categoria). A Lista não precisa: já é
  // autoexplicativa (tabela com cabeçalho de coluna nomeado).
  dica?: string;
}

// <Link> (não Tabs do shadcn/Radix) de propósito -- Mapa e Lista são rotas
// de verdade (/modulos/legalizacao/mapa e /modulos/legalizacao), não um
// switch de conteúdo dentro do mesmo componente. Tabs do Radix é pra troca
// de conteúdo client-side controlada por estado, navegação entre página é
// papel de link, só estilizado pra parecer o segmented control do mockup.
export function ToggleMapaLista({ ativo, dica }: ToggleMapaListaProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-7 py-3">
      <div className="flex rounded-md bg-muted p-0.5">
        <Link
          href="/modulos/legalizacao/mapa"
          className={cn(
            "rounded-md px-4 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors",
            ativo === "mapa" && "bg-card font-semibold text-foreground shadow-xs",
          )}
        >
          Mapa
        </Link>
        <Link
          href="/modulos/legalizacao"
          className={cn(
            "rounded-md px-4 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors",
            ativo === "lista" && "bg-card font-semibold text-foreground shadow-xs",
          )}
        >
          Lista
        </Link>
      </div>
      {dica && (
        <p className="hidden truncate text-[12px] text-muted-foreground sm:block">
          {dica}
        </p>
      )}
    </div>
  );
}
