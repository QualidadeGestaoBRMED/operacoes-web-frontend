"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import type { Demanda, DemandaResponsavel, Usuario } from "@/types";

const NIVEL_ADMIN_OPERACOES = 2;

function SeletorCandidato({
  candidatos,
  value,
  onValueChange,
}: {
  candidatos: Usuario[];
  value: string;
  onValueChange: (valor: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
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
  );
}

export function ResponsavelSection({
  demanda,
  podeEscrever,
  ativo,
  aoAbrir,
  aoFechar,
}: {
  demanda: Demanda;
  podeEscrever: boolean;
  // Coordenado pelo DetalheCard junto com o "ativo" do TransicaoStatusSection
  // -- só uma seção com formulário aberto por vez (achado no review).
  ativo: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
}) {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState("");
  const [tipoSelecionado, setTipoSelecionado] =
    useState<DemandaResponsavel["tipo"]>("colaborador");

  // Enquanto está definido, mostra o formulário de troca do principal em vez
  // do botão de remover na linha desse usuário -- ver ehUnicoPrincipal.
  const [trocandoUsuarioId, setTrocandoUsuarioId] = useState<number | null>(null);
  const [novoPrincipalId, setNovoPrincipalId] = useState("");
  const [trocando, setTrocando] = useState(false);
  // ConfirmDialog substitui o window.confirm() de antes.
  const [responsavelParaRemover, setResponsavelParaRemover] = useState<{
    usuarioId: number;
    nome: string;
  } | null>(null);

  // Reseta os dois formulários quando outra seção assume (ativo vira false
  // de fora), não só quando um deles fecha por conta própria.
  useEffect(() => {
    if (!ativo) {
      setFormularioAberto(false);
      setUsuarioSelecionadoId("");
      setTipoSelecionado("colaborador");
      setTrocandoUsuarioId(null);
      setNovoPrincipalId("");
    }
  }, [ativo]);

  const { usuarios } = useUsuarios();
  const { adicionar, isLoading: adicionando } = useAdicionarResponsavel(demanda.id);
  const { remover, isLoading: removendo } = useRemoverResponsavel(demanda.id);

  // Não filtra a busca de usuários pela unidade da demanda: o backend
  // (validate_usuario_id) permite um usuário sem unidade (admin) como
  // responsável de qualquer demanda, então o filtro precisa reproduzir essa
  // mesma regra em vez de só comparar unidade_id.
  function elegivel(usuario: Usuario) {
    return (
      usuario.unidade_id === demanda.unidade.id ||
      (usuario.perfil && usuario.perfil.nivel <= NIVEL_ADMIN_OPERACOES)
    );
  }

  const idsJaResponsaveis = new Set(demanda.responsaveis.map((r) => r.usuario.id));
  // Pra "Adicionar responsável": exclui quem já é responsável (duplicar dá
  // 400 no backend).
  const candidatosParaAdicionar = usuarios.filter(
    (usuario) => !idsJaResponsaveis.has(usuario.id) && elegivel(usuario),
  );
  // Achado no review do Tech Lead: candidatosParaAdicionar excluía TODO
  // responsável já existente -- inclusive um colaborador da própria demanda,
  // que é justamente quem mais faz sentido promover a principal. Pra
  // "Trocar", só o próprio usuário sendo substituído fica de fora.
  function candidatosParaTrocarPrincipal(usuarioSendoTrocadoId: number) {
    return usuarios.filter(
      (usuario) => usuario.id !== usuarioSendoTrocadoId && elegivel(usuario),
    );
  }

  const quantidadePrincipais = demanda.responsaveis.filter(
    (r) => r.tipo === "principal",
  ).length;
  // O backend recusa remover o único responsável principal (pedido do
  // Tech Lead no review do STC-193: a demanda não pode ficar sem principal
  // já em andamento). Em vez de deixar o usuário tomar um 400 ao clicar em
  // remover, a UI já oferece a troca direta por outra pessoa nesse caso.
  function ehUnicoPrincipal(responsavel: Demanda["responsaveis"][number]) {
    return responsavel.tipo === "principal" && quantidadePrincipais === 1;
  }

  async function aoAdicionar() {
    if (!usuarioSelecionadoId) return;
    try {
      await adicionar({ usuario_id: Number(usuarioSelecionadoId), tipo: tipoSelecionado });
      setUsuarioSelecionadoId("");
      setTipoSelecionado("colaborador");
      setFormularioAberto(false);
      aoFechar();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function confirmarRemocao() {
    if (!responsavelParaRemover) return;
    try {
      await remover(responsavelParaRemover.usuarioId);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setResponsavelParaRemover(null);
    }
  }

  async function aoTrocarPrincipal(antigoUsuarioId: number) {
    if (!novoPrincipalId) return;
    const novoId = Number(novoPrincipalId);
    setTrocando(true);
    try {
      // Se o escolhido já é colaborador desta demanda, precisa sair antes
      // de voltar como principal -- o backend recusa duplicar o par
      // demanda+usuario (não dá pra só "trocar o tipo" de um responsável
      // existente, esse endpoint não tem PATCH).
      if (demanda.responsaveis.some((r) => r.usuario.id === novoId)) {
        await remover(novoId);
      }
      // Adiciona o novo principal antes de remover o antigo: só depois
      // disso o antigo deixa de ser "o único principal" e a remoção passa
      // no guard do backend.
      await adicionar({ usuario_id: novoId, tipo: "principal" });
      await remover(antigoUsuarioId);
      setNovoPrincipalId("");
      setTrocandoUsuarioId(null);
      aoFechar();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setTrocando(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {demanda.responsaveis.length === 0 ? (
        <span className="text-sm text-muted-foreground">Sem responsáveis</span>
      ) : (
        demanda.responsaveis.map((responsavel) => (
          <div key={responsavel.usuario.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
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
              {podeEscrever &&
                (ehUnicoPrincipal(responsavel) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTrocandoUsuarioId(responsavel.usuario.id);
                      setFormularioAberto(false);
                      aoAbrir();
                    }}
                    className="ml-auto flex items-center gap-1 text-[11.5px] font-medium text-secondary hover:underline"
                    title="Este é o único responsável principal -- troque por outra pessoa em vez de remover"
                  >
                    <ArrowRightLeft className="size-3" />
                    Trocar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setResponsavelParaRemover({
                        usuarioId: responsavel.usuario.id,
                        nome: nomeExibicao(responsavel.usuario),
                      })
                    }
                    disabled={removendo}
                    aria-label={`Remover ${nomeExibicao(responsavel.usuario)}`}
                    className="ml-auto text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                ))}
            </div>

            {trocandoUsuarioId === responsavel.usuario.id && (
              <div className="ml-7 flex flex-col gap-1.5 rounded-md border border-border p-2">
                <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                  Novo principal
                </span>
                <SeletorCandidato
                  candidatos={candidatosParaTrocarPrincipal(responsavel.usuario.id)}
                  value={novoPrincipalId}
                  onValueChange={setNovoPrincipalId}
                />
                <div className="flex gap-1.5">
                  <Button
                    size="xs"
                    className="flex-1"
                    onClick={() => void aoTrocarPrincipal(responsavel.usuario.id)}
                    disabled={!novoPrincipalId || trocando}
                  >
                    Confirmar troca
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setTrocandoUsuarioId(null);
                      setNovoPrincipalId("");
                      aoFechar();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {podeEscrever &&
        (formularioAberto ? (
          <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-border p-2">
            <SeletorCandidato
              candidatos={candidatosParaAdicionar}
              value={usuarioSelecionadoId}
              onValueChange={setUsuarioSelecionadoId}
            />
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
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setFormularioAberto(false);
                  aoFechar();
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setFormularioAberto(true);
              setTrocandoUsuarioId(null);
              setNovoPrincipalId("");
              aoAbrir();
            }}
            className="mt-1 flex items-center gap-1 text-[12.5px] font-medium text-secondary hover:underline"
          >
            <Plus className="size-3" />
            Adicionar responsável
          </button>
        ))}

      <ConfirmDialog
        open={responsavelParaRemover !== null}
        onOpenChange={(open) => !open && setResponsavelParaRemover(null)}
        titulo="Remover responsável"
        descricao={`Remover ${responsavelParaRemover?.nome} dos responsáveis desta demanda?`}
        textoConfirmar="Remover"
        destrutivo
        isLoading={removendo}
        onConfirmar={() => void confirmarRemocao()}
      />
    </div>
  );
}
