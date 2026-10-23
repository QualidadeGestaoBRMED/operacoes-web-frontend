function cortar(nome: string, limite: number): string {
  return nome.length > limite ? `${nome.slice(0, limite - 1).trimEnd()}…` : nome;
}

/** Rótulo do eixo cortado com reticências; o nome inteiro fica na dica do navegador. */
export function RotuloDoEixo(props: {
  x?: number;
  y?: number;
  payload?: { value: string };
  caracteres: number;
}) {
  const { x, y, payload, caracteres } = props;
  if (x == null || y == null || !payload) return null;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" className="fill-muted-foreground">
      <title>{payload.value}</title>
      {cortar(payload.value, caracteres)}
    </text>
  );
}
