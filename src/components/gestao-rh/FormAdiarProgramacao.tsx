"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extrairMensagemErro } from "@/lib/erros";
import { errosDeCampo } from "@/lib/gestaoRH";

const MAXIMO_CARACTERES = 2000;

interface FormAdiarProgramacaoProps {
  periodoId: number;
  onSalvar: (justificativa: string) => Promise<unknown>;
  onCancelar: () => void;
}

export function FormAdiarProgramacao({ periodoId, onSalvar, onCancelar }: FormAdiarProgramacaoProps) {
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);
  const id = `adiar-${periodoId}`;

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    const texto = justificativa.trim();
    if (!texto) {
      setErro("A justificativa é obrigatória.");
      return;
    }
    setErro(undefined);
    setSalvando(true);
    try {
      await onSalvar(texto);
      toast.success("Programação adiada.");
    } catch (falha) {
      const porCampo = errosDeCampo(falha);
      if (porCampo.justificativa) setErro(porCampo.justificativa);
      else {
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
      <div className="space-y-1.5">
        <Label htmlFor={id}>Por que não programar agora? *</Label>
        <Textarea
          id={id}
          value={justificativa}
          maxLength={MAXIMO_CARACTERES}
          onChange={(evento) => setJustificativa(evento.target.value)}
          aria-invalid={!!erro}
          aria-describedby={erro ? `${id}-erro` : `${id}-ajuda`}
          rows={3}
        />
        {erro ? (
          <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">
            {erro}
          </p>
        ) : (
          <p id={`${id}-ajuda`} className="text-[12px] text-muted-foreground">
            A demanda do período é concluída; o próximo marco da régua abre outra.
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={salvando} onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
