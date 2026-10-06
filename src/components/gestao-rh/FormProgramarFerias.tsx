"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { extrairMensagemErro } from "@/lib/erros";
import { errosDeCampo, formatarDataISO } from "@/lib/gestaoRH";
import { diasEntre, limiteJaVencido, textoDias } from "@/lib/gestaoRHFerias";
import type { PeriodoPendente, ProgramarFeriasPayload } from "@/types/gestaoRH";

// Mesmo teto da API (CLT art. 130): uma programação cobre até 30 dias.
const MAXIMO_DIAS = 30;

type Campo = "data_inicio" | "data_fim";

function validar(
  inicio: string,
  fim: string,
  periodo: PeriodoPendente,
  hoje: string,
): Partial<Record<Campo, string>> {
  const erros: Partial<Record<Campo, string>> = {};
  if (!inicio) erros.data_inicio = "Obrigatório.";
  else if (inicio < hoje) erros.data_inicio = "O início não pode ser antes de hoje.";
  if (!fim) erros.data_fim = "Obrigatório.";
  if (erros.data_inicio || erros.data_fim) return erros;
  if (fim < inicio) erros.data_fim = "O fim precisa ser depois do início.";
  else if (diasEntre(inicio, fim) + 1 > MAXIMO_DIAS) {
    erros.data_fim = `No máximo ${MAXIMO_DIAS} dias por programação.`;
  } else if (!limiteJaVencido(periodo, hoje) && fim > periodo.limite_concessivo) {
    erros.data_fim = `As férias precisam terminar até o limite para tirar (${formatarDataISO(periodo.limite_concessivo)}).`;
  }
  return erros;
}

interface FormProgramarFeriasProps {
  periodo: PeriodoPendente;
  hoje: string;
  onSalvar: (payload: ProgramarFeriasPayload) => Promise<unknown>;
  onCancelar: () => void;
}

export function FormProgramarFerias({ periodo, hoje, onSalvar, onCancelar }: FormProgramarFeriasProps) {
  const atual = periodo.programacao;
  const [inicio, setInicio] = useState(atual?.data_inicio ?? "");
  const [fim, setFim] = useState(atual?.data_fim ?? "");
  const [substituicao, setSubstituicao] = useState(atual?.necessita_substituicao ?? false);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [salvando, setSalvando] = useState(false);

  const dias = inicio && fim && fim >= inicio ? diasEntre(inicio, fim) + 1 : null;
  const vencido = limiteJaVencido(periodo, hoje);
  const idPrefixo = `programar-${periodo.id}`;

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    const locais = validar(inicio, fim, periodo, hoje);
    setErros(locais);
    if (Object.keys(locais).length > 0) return;
    setSalvando(true);
    try {
      await onSalvar({ data_inicio: inicio, data_fim: fim, necessita_substituicao: substituicao });
      toast.success("Férias programadas.");
    } catch (falha) {
      const porCampo = errosDeCampo(falha);
      const naTela: Partial<Record<Campo, string>> = {};
      const semCampo: string[] = [];
      for (const [campo, mensagem] of Object.entries(porCampo)) {
        if (campo === "data_inicio" || campo === "data_fim") naTela[campo] = mensagem;
        else semCampo.push(mensagem);
      }
      setErros(naTela);
      if (semCampo.length > 0) toast.error(semCampo.join(" "));
      else if (Object.keys(porCampo).length === 0) toast.error(extrairMensagemErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={(evento) => void aoSubmeter(evento)}
      noValidate
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <p className="text-[13px] font-semibold text-foreground">
        {atual ? "Reprogramar férias" : "Programar férias"}
      </p>

      {vencido && (
        <p className="flex items-start gap-2 text-[12.5px] text-red-700">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Limite para tirar já vencido: as férias deste período serão pagas em dobro.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefixo}-inicio`}>Início *</Label>
          <Input
            id={`${idPrefixo}-inicio`}
            type="date"
            min={hoje}
            value={inicio}
            onChange={(evento) => setInicio(evento.target.value)}
            aria-invalid={!!erros.data_inicio}
            aria-describedby={erros.data_inicio ? `${idPrefixo}-inicio-erro` : undefined}
            className="h-9 w-40"
          />
          {erros.data_inicio && (
            <p id={`${idPrefixo}-inicio-erro`} role="alert" className="text-xs text-destructive">
              {erros.data_inicio}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefixo}-fim`}>Fim *</Label>
          <Input
            id={`${idPrefixo}-fim`}
            type="date"
            min={inicio || hoje}
            max={vencido ? undefined : periodo.limite_concessivo}
            value={fim}
            onChange={(evento) => setFim(evento.target.value)}
            aria-invalid={!!erros.data_fim}
            aria-describedby={erros.data_fim ? `${idPrefixo}-fim-erro` : undefined}
            className="h-9 w-40"
          />
          {erros.data_fim && (
            <p id={`${idPrefixo}-fim-erro`} role="alert" className="max-w-72 text-xs text-destructive">
              {erros.data_fim}
            </p>
          )}
        </div>
        {dias !== null && (
          <p className="pt-8 text-[13px] font-medium text-muted-foreground">{textoDias(dias)}</p>
        )}
      </div>

      <div className="flex items-start gap-3">
        <Switch
          id={`${idPrefixo}-substituicao`}
          checked={substituicao}
          onCheckedChange={setSubstituicao}
        />
        <div className="space-y-0.5">
          <Label htmlFor={`${idPrefixo}-substituicao`}>Precisa de substituição</Label>
          <p className="text-[12px] text-muted-foreground">
            Abre o prazo para acionar o RH (vaga, seleção, ASO), contado a partir do início das
            férias pela régua de férias.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={salvando} onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Registrar programação"}
        </Button>
      </div>
    </form>
  );
}
