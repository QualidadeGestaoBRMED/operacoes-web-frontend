"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AvatarUsuario } from "@/components/AvatarUsuario";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdicionarResponsavel,
  useRemoverResponsavel,
  useTrocarPrincipal,
} from "@/hooks/useResponsaveis";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { iniciaisDe, nomeExibicao } from "@/lib/utils";
import { administra, NIVEL_ADMIN_QG, redeDaUnidade, unidadesDoUsuario } from "@/lib/redes";
import type { Demanda, DemandaResponsavel, Usuario } from "@/types";


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
      <SelectTrigger size="sm" className="h-8 text-[13px]" aria-label="Usuário responsável">
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
  abrirComFormularioDeAdicionar,
}: {
  demanda: Demanda;
  podeEscrever: boolean;
  // Coordenado pelo DetalheCard junto com o "ativo" do TransicaoStatusSection
  // -- só uma seção com formulário aberto por vez (achado no review).
  ativo: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  // STC-203: quando o DetalheCard abre por causa de um drag-and-drop
  // bloqueado por falta de responsável principal, já chega com o
  // formulário de adicionar expandido -- falta só escolher quem assume.
  abrirComFormularioDeAdicionar?: boolean;
}) {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState("");
  const [tipoSelecionado, setTipoSelecionado] =
    useState<DemandaResponsavel["tipo"]>("colaborador");

  // Enquanto está definido, mostra o formulário de troca do principal em vez
  // do botão de remover na linha desse usuário -- ver ehUnicoPrincipal.
  const [trocandoUsuarioId, setTrocandoUsuarioId] = useState<number | null>(null);
  const [novoPrincipalId, setNovoPrincipalId] = useState("");
  // ConfirmDialog substitui o window.confirm() de antes.
  const [responsavelParaRemover, setResponsavelParaRemover] = useState<{
    usuarioId: number;
    nome: string;
  } | null>(null);

  // Sem Principal ainda, o próximo responsável adicionado tem mais chance de
  // ser justamente o Principal (é o que falta); já havendo um, o mais comum
  // é adicionar um Colaborador. Pré-seleciona o tipo mais provável em vez de
  // sempre partir de "Colaborador" e obrigar trocar manualmente.
  const jaTemPrincipal = demanda.responsaveis.some(
    (responsavel) => responsavel.tipo === "principal",
  );

  // Reseta os dois formulários quando outra seção assume (ativo vira false
  // de fora), não só quando um deles fecha por conta própria. Ao abrir,
  // já expande o formulário de adicionar se veio de fora (STC-203).
  useEffect(() => {
    if (!ativo) {
      setFormularioAberto(false);
      setUsuarioSelecionadoId("");
      setTipoSelecionado(jaTemPrincipal ? "colaborador" : "principal");
      setTrocandoUsuarioId(null);
      setNovoPrincipalId("");
    } else if (abrirComFormularioDeAdicionar) {
      setFormularioAberto(true);
      // secaoDoBloqueio (lib/kanban.ts) só manda abrir esta seção por um
      // motivo hoje: falta de responsável PRINCIPAL pra sair do Backlog --
      // então o tipo já vem pré-selecionado certo (sempre "principal" nesse
      // caso -- jaTemPrincipal já seria false, mas fica explícito porque é
      // exatamente essa garantia que justifica pular a checagem aqui).
      setTipoSelecionado("principal");
    }
  }, [ativo, abrirComFormularioDeAdicionar, jaTemPrincipal]);

  const { usuarios } = useUsuarios();
  const { adicionar, isLoading: adicionando } = useAdicionarResponsavel(demanda.id);
  const { remover, isLoading: removendo } = useRemoverResponsavel(demanda.id);
  const { trocarPrincipal, isLoading: trocando } = useTrocarPrincipal(demanda.id);

  // Não filtra a busca de usuários pela unidade da demanda: o backend
  // (validate_usuario_id) permite um usuário sem unidade (admin) como
  // responsável de qualquer demanda, então o filtro precisa reproduzir essa
  // mesma regra em vez de só comparar unidade_id.
  //
  // Admin Q&G fica de fora sempre, mesmo se por acaso tiver a mesma unidade
  // da demanda -- pedido do usuário: esse perfil é de supervisão/qualidade,
  // não de quem executa a demanda, então não deve aparecer como candidato a
  // responsável.
  function elegivel(usuario: Usuario) {
    if (usuario.perfil?.nivel === NIVEL_ADMIN_QG) return false;
    // Demanda do tipo de gestão "Operacional" não tem unidade (usa
    // area_responsavel): só quem administra a rede padrão (Admin
    // Operações ou Gestão de Operações), regra espelhada de
    // validate_usuario_id no backend.
    if (!demanda.unidade) return administra(usuario, "padrao");
    // Com unidade: quem é dela ou administra a rede dela (STC-747).
    return (
      unidadesDoUsuario(usuario).includes(demanda.unidade.id) ||
      administra(usuario, redeDaUnidade(demanda.unidade))
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
    try {
      // STC-230/STC-231: antes eram 2 requisições em sequência (adicionar
      // o novo, depois remover o antigo) -- se a 2ª falhasse depois da 1ª
      // ter sucesso, a demanda ficava com dois principais ao mesmo tempo.
      // trocarPrincipal() faz a troca inteira numa única transação no
      // backend.
      await trocarPrincipal({ antigoUsuarioId, novoUsuarioId: novoId });
      setNovoPrincipalId("");
      setTrocandoUsuarioId(null);
      aoFechar();
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
          <div key={responsavel.usuario.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <AvatarUsuario
                imagem={responsavel.usuario.foto_url}
                iniciais={iniciaisDe(nomeExibicao(responsavel.usuario))}
                className="size-6 bg-secondary text-[9px] font-bold text-secondary-foreground"
              />
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
              <SelectTrigger size="sm" className="h-8 text-[13px]" aria-label="Tipo de responsável">
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
              setTipoSelecionado(jaTemPrincipal ? "colaborador" : "principal");
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
