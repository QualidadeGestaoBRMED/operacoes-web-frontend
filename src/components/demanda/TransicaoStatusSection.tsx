"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useAtualizarStatusDemanda } from "@/hooks/useDemandaMutations";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import {
  ROTULO_STATUS,
  TRANSICOES_ADMIN_ONLY,
  TRANSICOES_SO_APROVADOR_OU_ADMIN,
  precisaAprovador,
  precisaJustificativa,
  proximosStatusValidos,
} from "@/lib/kanban";
import { nomeExibicao } from "@/lib/utils";
import type { Demanda, StatusDemanda } from "@/types";

const NIVEL_ADMIN_OPERACOES = 2;

// Mesmo padrão de AnexoList.tsx: esconde a opção que o usuário atual não tem
// como executar (em vez de mostrar tudo e deixar o backend rejeitar com 403).
function statusPermitidosParaUsuario(
  demanda: Demanda,
  isAdminOps: boolean,
  usuarioId: number | undefined,
): StatusDemanda[] {
  return proximosStatusValidos(demanda.status).filter((statusAlvo) => {
    const par = `${demanda.status}->${statusAlvo}`;
    if (TRANSICOES_ADMIN_ONLY.has(par)) return isAdminOps;
    if (TRANSICOES_SO_APROVADOR_OU_ADMIN.has(par)) {
      return isAdminOps || demanda.aprovador?.id === usuarioId;
    }
    return true;
  });
}

export function TransicaoStatusSection({
  demanda,
  podeEscrever,
}: {
  demanda: Demanda;
  podeEscrever: boolean;
}) {
  const { user, isAdminOps } = useAuth();
  const [formAberto, setFormAberto] = useState(false);
  const [statusAlvo, setStatusAlvo] = useState<StatusDemanda | "">("");
  const [aprovadorId, setAprovadorId] = useState("");
  const [justificativa, setJustificativa] = useState("");

  const { usuarios } = useUsuarios();
  const { atualizarStatus, isLoading } = useAtualizarStatusDemanda(demanda.id);

  const opcoesStatus = statusPermitidosParaUsuario(demanda, isAdminOps, user?.usuarioId);
  const exigeAprovador = statusAlvo ? precisaAprovador(demanda.status, statusAlvo) : false;
  const exigeJustificativa = statusAlvo ? precisaJustificativa(demanda.status, statusAlvo) : false;
  const candidatosAprovador = usuarios.filter(
    (usuario) => usuario.perfil && usuario.perfil.nivel <= NIVEL_ADMIN_OPERACOES,
  );

  const podeConfirmar =
    !!statusAlvo &&
    (!exigeAprovador || !!aprovadorId) &&
    (!exigeJustificativa || justificativa.trim() !== "");

  function fecharForm() {
    setFormAberto(false);
    setStatusAlvo("");
    setAprovadorId("");
    setJustificativa("");
  }

  async function aoConfirmar() {
    if (!statusAlvo) return;
    try {
      await atualizarStatus({
        status: statusAlvo,
        ...(exigeAprovador ? { aprovador_id: Number(aprovadorId) } : {}),
        ...(exigeJustificativa ? { justificativa } : {}),
      });
      fecharForm();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  if (!podeEscrever || opcoesStatus.length === 0) return null;

  if (!formAberto) {
    return (
      <button
        type="button"
        onClick={() => setFormAberto(true)}
        className="flex items-center gap-1 text-[12.5px] font-medium text-secondary hover:underline"
      >
        Mudar status
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
      <Select
        value={statusAlvo}
        onValueChange={(valor) => {
          setStatusAlvo(valor as StatusDemanda);
          setAprovadorId("");
          setJustificativa("");
        }}
      >
        <SelectTrigger size="sm" className="h-8 text-[13px]">
          <SelectValue placeholder="Selecionar novo status" />
        </SelectTrigger>
        <SelectContent>
          {opcoesStatus.map((status) => (
            <SelectItem key={status} value={status}>
              {ROTULO_STATUS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {exigeAprovador && (
        <Select value={aprovadorId} onValueChange={setAprovadorId}>
          <SelectTrigger size="sm" className="h-8 text-[13px]">
            <SelectValue placeholder="Selecionar aprovador" />
          </SelectTrigger>
          <SelectContent>
            {candidatosAprovador.length === 0 ? (
              <div className="px-2 py-1.5 text-[13px] text-muted-foreground">
                Nenhum candidato disponível
              </div>
            ) : (
              candidatosAprovador.map((usuario) => (
                <SelectItem key={usuario.id} value={String(usuario.id)}>
                  {nomeExibicao(usuario)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {exigeJustificativa && (
        <Textarea
          placeholder="Justificativa"
          rows={2}
          className="text-[13px]"
          value={justificativa}
          onChange={(evento) => setJustificativa(evento.target.value)}
        />
      )}

      <div className="flex gap-1.5">
        <Button
          size="xs"
          className="flex-1"
          onClick={() => void aoConfirmar()}
          disabled={!podeConfirmar || isLoading}
        >
          Confirmar
        </Button>
        <Button size="xs" variant="ghost" onClick={fecharForm}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
