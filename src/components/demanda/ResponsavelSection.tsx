"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdicionarResponsavel, useRemoverResponsavel } from "@/hooks/useResponsaveis";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { iniciaisDe, nomeExibicao } from "@/lib/utils";
import type { Demanda, DemandaResponsavel } from "@/types";

const NIVEL_ADMIN_OPERACOES = 2;

export function ResponsavelSection({
  demanda,
  podeEscrever,
}: {
  demanda: Demanda;
  podeEscrever: boolean;
}) {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState("");
  const [tipoSelecionado, setTipoSelecionado] =
    useState<DemandaResponsavel["tipo"]>("colaborador");

  const { usuarios } = useUsuarios();
  const { adicionar, isLoading: adicionando } = useAdicionarResponsavel(demanda.id);
  const { remover, isLoading: removendo } = useRemoverResponsavel(demanda.id);

  const idsJaResponsaveis = new Set(demanda.responsaveis.map((r) => r.usuario.id));
  // Não filtra a busca de usuários pela unidade da demanda: o backend
  // (validate_usuario_id) permite um usuário sem unidade (admin) como
  // responsável de qualquer demanda, então o filtro precisa reproduzir essa
  // mesma regra em vez de só comparar unidade_id.
  const candidatos = usuarios.filter(
    (usuario) =>
      !idsJaResponsaveis.has(usuario.id) &&
      (usuario.unidade_id === demanda.unidade.id ||
        (usuario.perfil && usuario.perfil.nivel <= NIVEL_ADMIN_OPERACOES)),
  );

  async function aoAdicionar() {
    if (!usuarioSelecionadoId) return;
    try {
      await adicionar({ usuario_id: Number(usuarioSelecionadoId), tipo: tipoSelecionado });
      setUsuarioSelecionadoId("");
      setTipoSelecionado("colaborador");
      setFormularioAberto(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function aoRemover(usuarioId: number, nome: string) {
    if (!window.confirm(`Remover ${nome} dos responsáveis desta demanda?`)) return;
    try {
      await remover(usuarioId);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {demanda.responsaveis.length === 0 ? (
        <span className="text-sm text-muted-foreground">Sem responsáveis</span>
      ) : (
        demanda.responsaveis.map((responsavel) => (
          <div key={responsavel.usuario.id} className="flex items-center gap-1.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
              {iniciaisDe(nomeExibicao(responsavel.usuario))}
            </div>
            <span className="text-[13.5px] font-medium text-foreground">
              {nomeExibicao(responsavel.usuario)}
            </span>
            {responsavel.tipo === "principal" && (
              <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">
                principal
              </span>
            )}
            {podeEscrever && (
              <button
                type="button"
                onClick={() =>
                  void aoRemover(responsavel.usuario.id, nomeExibicao(responsavel.usuario))
                }
                disabled={removendo}
                aria-label={`Remover ${nomeExibicao(responsavel.usuario)}`}
                className="ml-auto text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))
      )}

      {podeEscrever &&
        (formularioAberto ? (
          <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-border p-2">
            <Select value={usuarioSelecionadoId} onValueChange={setUsuarioSelecionadoId}>
              <SelectTrigger size="sm" className="h-8 text-[13px]">
                <SelectValue placeholder="Selecionar usuário" />
              </SelectTrigger>
              <SelectContent>
                {candidatos.length === 0 ? (
                  <div className="px-2 py-1.5 text-[13px] text-muted-foreground">
                    Nenhum candidato disponível
                  </div>
                ) : (
                  candidatos.map((usuario) => (
                    <SelectItem key={usuario.id} value={String(usuario.id)}>
                      {nomeExibicao(usuario)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Select
              value={tipoSelecionado}
              onValueChange={(valor) => setTipoSelecionado(valor as DemandaResponsavel["tipo"])}
            >
              <SelectTrigger size="sm" className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Button
                size="xs"
                className="flex-1"
                onClick={() => void aoAdicionar()}
                disabled={!usuarioSelecionadoId || adicionando}
              >
                Adicionar
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setFormularioAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFormularioAberto(true)}
            className="mt-1 flex items-center gap-1 text-[12.5px] font-medium text-secondary hover:underline"
          >
            <Plus className="size-3" />
            Adicionar responsável
          </button>
        ))}
    </div>
  );
}
