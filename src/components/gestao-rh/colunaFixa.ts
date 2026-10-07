// Coluna do colaborador congelada ao rolar a tabela para o lado (celular),
// como nas tabelas da Administração. A célula precisa de fundo opaco para as
// outras colunas não aparecerem por trás; no hover, a mesma cor da linha
// (secondary a 5% sobre o card) já misturada, em vez da translúcida. O
// contêiner zera o esmaecido da borda esquerda do `scroll-fade-x` (máscara
// do shadcn/tailwind.css), que senão apagaria a coluna congelada.
export const CLASSE_ROLAGEM_SEM_FADE_INICIAL = "[--scroll-fade-s-size:0px]";
export const CLASSE_CABECALHO_FIXO = "left-0 z-20";
export const CLASSE_CABECALHO = "z-10";
export const CLASSE_CELULA_FIXA =
  "sticky left-0 z-[1] bg-card group-hover:bg-[color-mix(in_oklab,var(--secondary)_5%,var(--card))]";
