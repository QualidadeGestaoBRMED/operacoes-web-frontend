"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { extrairMensagemErro } from "@/lib/erros";
import { errosDeCampo } from "@/lib/gestaoRH";
import { ACOES_TRATAMENTO, ROTULO_ACAO_TRATAMENTO } from "@/lib/gestaoRHAbsenteismo";
import type { AcaoTratamento } from "@/types/gestaoRH";

const MAXIMO_CARACTERES = 2000;

interface FormRegistrarTratamentoProps {
  alertaId: number;
  onSalvar: (acao: AcaoTratamento, justificativa: string) => Promise<unknown>;
  onCancelar: () => void;
}

export function FormRegistrarTratamento({ alertaId, onSalvar, onCancelar }: FormRegistrarTratamentoProps) {
  const [acao, setAcao] = useState<AcaoTratamento>();
  const [justificativa, setJustificativa] = useState("");
  const [erros, setErros] = useState<{ acao?: string; justificativa?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const id = `tratamento-${alertaId}`;

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    const texto = justificativa.trim();
    const locais = {
      acao: acao ? undefined : "Escolha a ação tomada.",
      justificativa: texto ? undefined : "A justificativa é obrigatória.",
    };
    setErros(locais);
    if (!acao || !texto) return;
    setSalvando(true);
    try {
      await onSalvar(acao, texto);
      toast.success("Tratamento registrado.");
    } catch (falha) {
      const porCampo = errosDeCampo(falha);
      if (porCampo.acao || porCampo.justificativa) {
        setErros({ acao: porCampo.acao, justificativa: porCampo.justificativa });
      } else {
        const mensagem = Object.values(porCampo).join(" ");
        toast.error(mensagem || extrairMensagemErro(falha));
      }
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
      <p className="text-[13px] font-semibold text-foreground">Registrar tratamento</p>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-acao`}>Ação tomada *</Label>
        <Select value={acao} onValueChange={(valor) => setAcao(valor as AcaoTratamento)}>
          <SelectTrigger
            id={`${id}-acao`}
            className="w-full sm:w-80"
            aria-invalid={!!erros.acao}
            aria-describedby={erros.acao ? `${id}-acao-erro` : undefined}
          >
            <SelectValue placeholder="Selecione a ação" />
          </SelectTrigger>
          <SelectContent position="popper">
            {ACOES_TRATAMENTO.map((item) => (
              <SelectItem key={item} value={item}>
                {ROTULO_ACAO_TRATAMENTO[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erros.acao && (
          <p id={`${id}-acao-erro`} role="alert" className="text-xs text-destructive">
            {erros.acao}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-justificativa`}>Justificativa *</Label>
        <Textarea
          id={`${id}-justificativa`}
          value={justificativa}
          maxLength={MAXIMO_CARACTERES}
          onChange={(evento) => setJustificativa(evento.target.value)}
          placeholder="Descreva o que foi conversado ou decidido."
          aria-invalid={!!erros.justificativa}
          aria-describedby={erros.justificativa ? `${id}-justificativa-erro` : undefined}
          rows={3}
        />
        {erros.justificativa && (
          <p id={`${id}-justificativa-erro`} role="alert" className="text-xs text-destructive">
            {erros.justificativa}
          </p>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground">
        Ao registrar, o alerta é encerrado e a demanda é concluída no Kanban.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={salvando} onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Registrar tratamento"}
        </Button>
      </div>
    </form>
  );
}
