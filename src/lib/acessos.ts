import { hojeNoFusoDoServidor } from "@/lib/kanban";
import type { UsuarioAcesso } from "@/types";

/** A partir de quantos dias sem entrar a pessoa fica em destaque. */
export const DIAS_SEM_ENTRAR_EM_DESTAQUE = 3;

export const PERIODOS_DE_ACESSO = [
  { dias: 30, rotulo: "Últimos 30 dias" },
  { dias: 90, rotulo: "Últimos 90 dias" },
  { dias: 365, rotulo: "Últimos 12 meses" },
] as const;

function deslocarDias(iso: string, dias: number) {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Primeiro dia de um período de `dias` dias que termina hoje (fuso do servidor). */
export function inicioDoPeriodo(dias: number, hoje = hojeNoFusoDoServidor()) {
  return deslocarDias(hoje, -(dias - 1));
}

/** Quantos dias tem o período, as duas pontas incluídas. */
export function diasNoPeriodo(inicio: string, fim: string) {
  const ms = new Date(`${fim}T00:00:00Z`).getTime() - new Date(`${inicio}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Nunca entrou ou está há 3 dias ou mais sem entrar. */
export function emDestaque(usuario: UsuarioAcesso) {
  return (
    usuario.dias_desde_o_ultimo_uso === null ||
    usuario.dias_desde_o_ultimo_uso >= DIAS_SEM_ENTRAR_EM_DESTAQUE
  );
}

export function formatarDataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function rotuloDoUltimoUso(usuario: UsuarioAcesso) {
  if (usuario.ultimo_uso === null) return "Nunca entrou";
  if (usuario.dias_desde_o_ultimo_uso === 0) return "Hoje";
  if (usuario.dias_desde_o_ultimo_uso === 1) return "Ontem";
  return formatarDataCurta(usuario.ultimo_uso);
}

export function rotuloDosDiasSemEntrar(usuario: UsuarioAcesso) {
  const dias = usuario.dias_desde_o_ultimo_uso;
  if (dias === null) return "Nunca entrou";
  if (dias === 0) return "Entrou hoje";
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

/** Unidade ou, sem ela, o setor. */
export function lotacao(usuario: UsuarioAcesso) {
  return usuario.unidade?.nome ?? usuario.setor?.nome ?? null;
}

export interface MesDoCalendario {
  /** "2026-10" */
  chave: string;
  rotulo: string;
  /** Casas vazias antes do dia 1, para o dia cair na coluna do dia da semana. */
  vazias: number;
  dias: { iso: string; numero: number; noPeriodo: boolean }[];
}

const FORMATADOR_MES = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Meses que o período toca, com todos os dias de cada um. */
export function mesesDoPeriodo(inicio: string, fim: string): MesDoCalendario[] {
  const meses: MesDoCalendario[] = [];
  let ano = Number(inicio.slice(0, 4));
  let mes = Number(inicio.slice(5, 7));
  const ultimo = fim.slice(0, 7);
  for (;;) {
    const chave = `${ano}-${String(mes).padStart(2, "0")}`;
    const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
    const totalDeDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    meses.push({
      chave,
      rotulo: FORMATADOR_MES.format(primeiro),
      vazias: primeiro.getUTCDay(),
      dias: Array.from({ length: totalDeDias }, (_, i) => {
        const iso = `${chave}-${String(i + 1).padStart(2, "0")}`;
        return { iso, numero: i + 1, noPeriodo: iso >= inicio && iso <= fim };
      }),
    });
    if (chave >= ultimo) break;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return meses;
}
