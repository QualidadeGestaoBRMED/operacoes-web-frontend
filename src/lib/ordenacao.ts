// Motor de ordenação por coluna, extraído de legalizacaoMatriz.ts (STC-378)
// -- genérico o bastante pra qualquer tabela do Atlas com colunas
// clicáveis/ordenáveis, não amarrado a nenhum módulo específico. Cada
// consumidor só precisa fornecer, por campo, uma função que extrai uma
// chave comparável (string/number) do item, ou null quando o item não tem
// valor pra esse campo (ex.: "sem responsável").

export type DirecaoOrdenacao = "asc" | "desc";

export interface Ordenacao<Campo extends string> {
  campo: Campo;
  direcao: DirecaoOrdenacao;
}

export type ExtratoresDeChave<T, Campo extends string> = Record<
  Campo,
  (item: T) => string | number | null
>;

// null sempre vai pro final, nas duas direções -- não faz sentido "sem
// responsável"/"sem prazo" aparecer entre os primeiros só porque a
// ordenação foi invertida (achado em teste: aplicar o sinal de asc/desc
// direto num comparador com "return 1/-1" pra null invertia a posição dele
// junto com o resto do critério).
export function ordenarPor<T, Campo extends string>(
  itens: T[],
  ordenacao: Ordenacao<Campo> | null,
  chaves: ExtratoresDeChave<T, Campo>,
): T[] {
  if (!ordenacao) return itens;
  const chaveDe = chaves[ordenacao.campo];
  const sinal = ordenacao.direcao === "asc" ? 1 : -1;
  // .toSorted() (não .sort()): quem chama normalmente tem o array vindo de
  // useSWR/useMemo -- mutar o original quebraria a referência que outros
  // consumidores (busca, filtro) esperam permanecer estável entre renders.
  return itens.toSorted((a, b) => {
    const chaveA = chaveDe(a);
    const chaveB = chaveDe(b);
    if (chaveA === null && chaveB === null) return 0;
    if (chaveA === null) return 1;
    if (chaveB === null) return -1;
    if (typeof chaveA === "string" && typeof chaveB === "string") {
      return chaveA.localeCompare(chaveB) * sinal;
    }
    return ((chaveA as number) - (chaveB as number)) * sinal;
  });
}
