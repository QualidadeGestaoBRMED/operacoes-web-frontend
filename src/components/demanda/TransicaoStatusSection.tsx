"use client";

import { useEffect, useState } from "react";
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
  precisaAprovador,
  precisaJustificativa,
  statusPermitidosParaUsuario,
} from "@/lib/kanban";
import { nomeExibicao } from "@/lib/utils";
import type { Demanda, StatusDemanda } from "@/types";

const NIVEL_ADMIN_OPERACOES = 2;

export function TransicaoStatusSection({
  demanda,
  podeEscrever,
  ativo,
  aoAbrir,
  aoFechar,
  statusAlvoInicial,
}: {
  demanda: Demanda;
  podeEscrever: boolean;
  // Coordenado pelo DetalheCard (junto com o "ativo" do ResponsavelSection)
  // pra só uma seção com formulário ficar aberta por vez -- achado no
  // review: sem isso, "Mudar status" e "Adicionar responsável"/"Trocar"
  // principal podiam ficar abertos ao mesmo tempo, empilhados na coluna.
  ativo: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  // STC-203: quando o DetalheCard abre por causa de um drag-and-drop
  // bloqueado, já chega com o destino que o usuário tinha arrastado --
  // evita que ele precise escolher de novo o que já tinha escolhido.
  // undefined no clique manual em "Mudar status" (comportamento de sempre).
  statusAlvoInicial?: StatusDemanda;
}) {
  const { user, isAdminOps, isLoading: carregandoAuth } = useAuth();
  const [statusAlvo, setStatusAlvo] = useState<StatusDemanda | "">("");
  const [aprovadorId, setAprovadorId] = useState("");
  const [justificativa, setJustificativa] = useState("");

  const { usuarios } = useUsuarios();
  const { atualizarStatus, isLoading } = useAtualizarStatusDemanda(demanda.id);

  const opcoesStatus = statusPermitidosParaUsuario(demanda, isAdminOps, user?.usuarioId);

  // Reseta os campos quando outra seção assume (ativo vira false de fora),
  // não só quando este componente fecha por conta própria. Ao abrir, parte
  // de statusAlvoInicial se veio de fora (STC-203) -- mas só se ainda for
  // uma opção válida pro usuário atual: mensagemBloqueioConhecido/
  // secaoDoBloqueio (lib/kanban.ts) checam só a estrutura da transição, sem
  // saber quem está arrastando. Um usuário comum arrastando Em Revisão ->
  // Em Andamento (rejeição, exige aprovador/admin) cai aqui com
  // "em_andamento" como destino, mas opcoesStatus filtra essa opção fora
  // pra quem não é aprovador/admin -- sem essa checagem, o Select
  // receberia um value sem SelectItem correspondente (mesma classe de bug
  // já achada no Select de "Nenhum" da STC-205). opcoesStatus de propósito
  // fora das deps: só precisa ser validado no instante em que a seção abre,
  // não a cada re-render (senão o array novo a cada render reabriria o
  // efeito e apagaria a escolha manual do usuário no meio da interação).
  //
  // Achado no review: carregandoAuth entra nas deps de propósito -- se a
  // seção abre (ativo=true) antes de useAuth() estabilizar, isAdminOps/user
  // ainda estão no valor "deslogado" e opcoesStatus sai incompleta/vazia
  // nesse primeiro cálculo, gravando "" mesmo com um statusAlvoInicial
  // válido. Sem carregandoAuth nas deps, o efeito não reavaliava quando a
  // sessão terminava de carregar um instante depois, perdendo o destino
  // pré-selecionado pro resto da interação.
  useEffect(() => {
    if (!ativo) {
      setStatusAlvo("");
      setAprovadorId("");
      setJustificativa("");
      return;
    }
    if (carregandoAuth) return;
    setStatusAlvo(
      statusAlvoInicial && opcoesStatus.includes(statusAlvoInicial) ? statusAlvoInicial : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, statusAlvoInicial, carregandoAuth]);

  const exigeAprovador = statusAlvo ? precisaAprovador(demanda.status, statusAlvo) : false;
  const exigeJustificativa = statusAlvo ? precisaJustificativa(demanda.status, statusAlvo) : false;
  const candidatosAprovador = usuarios.filter(
    (usuario) => usuario.perfil && usuario.perfil.nivel <= NIVEL_ADMIN_OPERACOES,
  );

  const podeConfirmar =
    !!statusAlvo &&
    (!exigeAprovador || !!aprovadorId) &&
    (!exigeJustificativa || justificativa.trim() !== "");

  async function aoConfirmar() {
    if (!statusAlvo) return;
    try {
      await atualizarStatus({
        status: statusAlvo,
        ...(exigeAprovador ? { aprovador_id: Number(aprovadorId) } : {}),
        ...(exigeJustificativa ? { justificativa } : {}),
      });
      aoFechar();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  if (!podeEscrever || opcoesStatus.length === 0) return null;

  if (!ativo) {
    return (
      <button
        type="button"
        onClick={aoAbrir}
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
        <SelectTrigger size="sm" className="h-8 text-[13px]" aria-label="Novo status">
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
          <SelectTrigger size="sm" className="h-8 text-[13px]" aria-label="Aprovador">
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
        <Button size="xs" variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
