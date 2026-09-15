import Link from "next/link";
import { cn } from "@/lib/utils";

// Achado em code review: dica/linkBiblioteca ocupam o mesmo espaço à
// direita do segmented control -- um union discriminado (em vez de duas
// props opcionais soltas) faz o TypeScript recusar quem tentar passar as
// duas ao mesmo tempo, não só um comentário pedindo pra não fazer isso.
type ToggleMapaListaProps =
  | {
      ativo: "mapa" | "lista";
      // Opcional, só o Mapa passa (STC-379) -- achado no review visual:
      // sem nenhuma explicação na tela, não fica óbvio que a célula é
      // clicável nem o que ela representa (unidade × categoria). A Lista
      // não precisa: já é autoexplicativa (tabela com cabeçalho de coluna
      // nomeado).
      dica?: string;
      linkBiblioteca?: never;
    }
  | {
      ativo: "mapa" | "lista";
      dica?: never;
      // Só a Lista passa (STC-416) -- Biblioteca de Documentos é uma tela
      // de paradigma diferente (leitura por unidade só, não outra visão da
      // mesma matriz), por isso não vira um 3º item do segmented control
      // acima, só um link à parte no mesmo espaço que o Mapa usa pra
      // "dica".
      linkBiblioteca?: boolean;
    };

// <Link> (não Tabs do shadcn/Radix) de propósito -- Mapa e Lista são rotas
// de verdade (/modulos/legalizacao/mapa e /modulos/legalizacao), não um
// switch de conteúdo dentro do mesmo componente. Tabs do Radix é pra troca
// de conteúdo client-side controlada por estado, navegação entre página é
// papel de link, só estilizado pra parecer o segmented control do mockup.
// hidden sm:flex -- Mapa não tem layout mobile (MapaConformidade.tsx
// redireciona pra Lista em telas estreitas), então o toggle não faz
// sentido aparecer nesse tamanho: só sobraria "Lista" sozinha, um segmented
// control sem pra onde ir.
export function ToggleMapaLista({
  ativo,
  dica,
  linkBiblioteca,
}: ToggleMapaListaProps) {
  return (
    <div className="hidden items-center justify-between gap-4 border-b border-border px-7 py-3 sm:flex">
      <div className="flex rounded-md bg-muted p-0.5">
        <Link
          href="/modulos/legalizacao/mapa"
          aria-current={ativo === "mapa" ? "page" : undefined}
          className={cn(
            "rounded-md px-4 py-1.5 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
            ativo === "mapa" &&
              "bg-card font-semibold text-foreground shadow-xs",
          )}
        >
          Mapa
        </Link>
        <Link
          href="/modulos/legalizacao"
          aria-current={ativo === "lista" ? "page" : undefined}
          className={cn(
            "rounded-md px-4 py-1.5 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
            ativo === "lista" &&
              "bg-card font-semibold text-foreground shadow-xs",
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
      {linkBiblioteca && (
        <Link
          href="/modulos/legalizacao/biblioteca"
          className="ml-auto hidden text-[12.5px] font-medium text-secondary hover:underline sm:block"
        >
          Biblioteca de Documentos →
        </Link>
      )}
    </div>
  );
}
