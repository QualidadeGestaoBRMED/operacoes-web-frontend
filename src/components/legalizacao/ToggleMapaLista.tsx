import Link from "next/link";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { cn } from "@/lib/utils";
import { BotaoExportarSituacao } from "./ExportarSituacaoModal";
import { SeletorRedeLegalizacao } from "./SeletorRedeLegalizacao";

// Achado em code review: dica/linkBiblioteca ocupam o mesmo espaço à
// direita do segmented control -- um union discriminado (em vez de duas
// props opcionais soltas) faz o TypeScript recusar quem tentar passar as
// duas ao mesmo tempo, não só um comentário pedindo pra não fazer isso.
type ToggleMapaListaProps = (
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
    }
) & {
  // STC-451: Coordenação da Unidade só acompanha a própria unidade -- o
  // Mapa é o panorama da rede inteira (MapaConformidade.tsx não filtra por
  // unidade de propósito), não faz sentido nenhum pra esse perfil. Default
  // true (mostra o toggle normal) -- só quem sabe o perfil do usuário
  // (MatrizConformidade.tsx/MapaConformidade.tsx, via useAuth()) decide
  // passar false.
  mostrarMapa?: boolean;
};

// <Link> (não Tabs do shadcn/Radix) de propósito -- Mapa e Lista são rotas
// de verdade (/modulos/legalizacao/mapa e /modulos/legalizacao), não um
// switch de conteúdo dentro do mesmo componente. Tabs do Radix é pra troca
// de conteúdo client-side controlada por estado, navegação entre página é
// papel de link, só estilizado pra parecer o segmented control do mockup.
export function ToggleMapaLista({
  ativo,
  dica,
  linkBiblioteca,
  mostrarMapa = true,
}: ToggleMapaListaProps) {
  const { podeEscolher } = useRedeDaLegalizacao();
  return (
    // Abaixo de `sm` (640px), o toggle Mapa/Lista e a dica ficam
    // escondidos: o Mapa não tem layout estreito (MapaConformidade.tsx
    // redireciona para a Lista abaixo de 640px). O link da Biblioteca some
    // abaixo de `md` (768px), o mesmo corte de QUERY_MOBILE em que o
    // AppShell troca o menu lateral pelas abas do módulo (AbasDoModulo),
    // que já levam à Biblioteca. Abaixo de `sm` sobra só o seletor de rede;
    // sem ele, a barra inteira some, para não deixar uma faixa vazia entre
    // as abas e a busca.
    <div
      className={cn(
        "items-center justify-between gap-4 border-b border-border px-7 py-3",
        podeEscolher ? "flex" : "hidden sm:flex",
      )}
    >
      <div className="flex items-center gap-3">
        {mostrarMapa ? (
          <div className="hidden rounded-md bg-muted p-0.5 sm:flex">
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
        ) : (
          // Sem Mapa disponível (Coordenação da Unidade, STC-451), um
          // segmented control com "Lista" sozinha não teria pra onde
          // alternar -- mesmo raciocínio do "hidden sm:flex" acima pro
          // mobile. Só o rótulo, sem virar link (já estamos na única tela
          // que existe pra esse perfil).
          <span className="hidden px-1 text-[12.5px] font-semibold text-foreground sm:block">
            Lista
          </span>
        )}
        <SeletorRedeLegalizacao />
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-4">
        {dica && (
          <p className="hidden truncate text-[12px] text-muted-foreground sm:block">
            {dica}
          </p>
        )}
        {linkBiblioteca && (
          <Link
            href="/modulos/legalizacao/biblioteca"
            className="hidden shrink-0 text-[12.5px] font-medium text-secondary hover:underline md:inline"
          >
            Biblioteca de Documentos →
          </Link>
        )}
        {/* STC-963: igual no Mapa e na Lista, só no computador. */}
        <BotaoExportarSituacao />
      </div>
    </div>
  );
}
