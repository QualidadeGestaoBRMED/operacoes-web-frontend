/** Ao lado do cargo, nas listas dos painéis do período: o desligado continua
 * nos meses em que trabalhou (STC-859), mas não é mais de ninguém tratar. */
export function EtiquetaDesligado() {
  return (
    <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-bold text-muted-foreground uppercase">
      Desligado
    </span>
  );
}
