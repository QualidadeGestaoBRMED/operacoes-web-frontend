interface MiniLineChartProps {
  valores: number[];
  corLinha?: string;
  corDestaque?: string;
  className?: string;
}

/**
 * Sparkline compacta em SVG puro — sem lib de gráficos ainda.
 * Isolada em componente próprio de propósito: quando o especialista de BI
 * validar a escolha de biblioteca/tipo de gráfico ideal, só essa peça troca.
 */
export function MiniLineChart({
  valores,
  corLinha = "var(--secondary)",
  corDestaque = "var(--chart-3)",
  className,
}: MiniLineChartProps) {
  const largura = 260;
  const altura = 90;
  const margem = 6;

  // Sem valores, nao ha o que desenhar. Com 1 valor, "i / (length - 1)"
  // seria divisao por zero (0/0 = NaN) -- os dois casos precisam de guarda
  // antes de qualquer conta.
  if (valores.length === 0) {
    return null;
  }

  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const amplitude = max - min || 1;
  const divisor = valores.length - 1 || 1;

  const pontos = valores.map((valor, i) => {
    const x = margem + (i / divisor) * (largura - margem * 2);
    const y = altura - margem - ((valor - min) / amplitude) * (altura - margem * 2);
    return { x, y };
  });

  const linha = pontos.map((p) => `${p.x},${p.y}`).join(" L");
  const area = `M${linha} L${pontos[pontos.length - 1].x},${altura} L${pontos[0].x},${altura} Z`;
  const ultimo = pontos[pontos.length - 1];
  const gradientId = "mini-line-chart-gradient";

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={corLinha} stopOpacity=".28" />
          <stop offset="1" stopColor={corLinha} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={`M${linha}`}
        fill="none"
        stroke={corLinha}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={ultimo.x} cy={ultimo.y} r={13} fill={corDestaque} opacity={0.16} />
      <circle cx={ultimo.x} cy={ultimo.y} r={5} fill={corDestaque} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}
