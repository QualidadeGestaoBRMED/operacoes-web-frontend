import Link from "next/link";
import { cn } from "@/lib/utils";
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
  return (
    // Acha achado em dogfooding: o "hidden sm:flex" ficava na div de fora,
    // então escondia o linkBiblioteca junto com o segmented control --
    // Biblioteca de Documentos (STC-416/441) não tinha NENHUMA outra forma
    // de navegação no mobile (sidebar hoje é um link só por módulo, sem
    // submenu), ficando inacessível nesse tamanho de tela. O que não tem
    // layout mobile é só o toggle Mapa/Lista (MapaConformidade.tsx
    // redireciona pra Lista em telas estreitas) -- por isso o "hidden
    // sm:flex/sm:block" migrou pra dentro de cada ramo do toggle, não pro
    // container inteiro.
    <div className="flex items-center justify-between gap-4 border-b border-border px-7 py-3">
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
      {dica && (
        <p className="hidden truncate text-[12px] text-muted-foreground sm:block">
          {dica}
        </p>
      )}
      {linkBiblioteca && (
        <Link
          href="/modulos/legalizacao/biblioteca"
          className="ml-auto text-[12.5px] font-medium text-secondary hover:underline"
        >
          Biblioteca de Documentos →
        </Link>
      )}
    </div>
  );
}
