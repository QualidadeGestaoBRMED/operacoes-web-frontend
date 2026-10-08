// Coluna do colaborador congelada ao rolar a tabela para o lado (celular),
// como nas tabelas da Administração. A célula precisa de fundo opaco para as
// outras colunas não aparecerem por trás; no hover, a mesma cor da linha
// (secondary a 5% sobre o card) já misturada, em vez da translúcida.
//
// `scroll-fade-x` tem duas definições com o mesmo nome: a de
// `src/app/globals.css` (sombras de fundo) e a `@utility scroll-fade-x` de
// `node_modules/shadcn/dist/tailwind.css`, importada na linha 3 do
// globals.css. A do shadcn aplica um `mask-image` que esmaece a borda
// esquerda ao rolar, e apagaria a coluna congelada. `--scroll-fade-s-size` é
// a variável dessa utility que define o tamanho do esmaecido da borda
// esquerda; zerada, a borda direita (que indica mais colunas) continua.
export const CLASSE_ROLAGEM_SEM_FADE_INICIAL = "[--scroll-fade-s-size:0px]";
export const CLASSE_CABECALHO_FIXO = "left-0 z-20";
export const CLASSE_CABECALHO = "z-10";
export const CLASSE_CELULA_FIXA =
  "sticky left-0 z-[1] bg-card group-hover:bg-[color-mix(in_oklab,var(--secondary)_5%,var(--card))]";
