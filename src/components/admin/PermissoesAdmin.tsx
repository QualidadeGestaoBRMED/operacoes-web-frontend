"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes, useRevogarPermissao } from "@/hooks/usePermissoes";
import { useSetores } from "@/hooks/useSetores";
import { useUnidades } from "@/hooks/useUnidades";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { formatarDataHora, nomeExibicao } from "@/lib/utils";
import type { AcaoPermissao, EscopoPermissao, PermissaoUsuario } from "@/types";
import { FormNovaPermissao } from "./FormNovaPermissao";

const ROTULO_ACAO: Record<AcaoPermissao, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  aprovar: "Aprovar",
  excluir: "Excluir",
  restaurar: "Restaurar",
  configurar: "Configurar",
};

const ROTULO_ESCOPO: Record<EscopoPermissao, string> = {
  global: "Global",
  unidade: "Unidade",
  setor: "Setor",
  proprio: "Próprio",
};

function formatarData(data: string) {
  // "YYYY-MM-DD" (DateField do Django) formatado sem passar por Date --
  // new Date("2026-03-05") interpreta como UTC meia-noite, que em fusos a
  // oeste de UTC (todo o Brasil) exibe o dia ANTERIOR ao real.
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Achado no dogfooding: hoje() em "YYYY-MM-DD" (mesmo formato de
// data_inicio/data_fim) pra comparar como string, sem risco de fuso horário
// -- mesma classe de cuidado documentada em hojeNoFusoDoServidor (lib/kanban.ts).
function hoje() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// Espelha PermissaoUsuarioManager.ativas() (backend/plataforma/models.py):
// ativo=True, data_inicio já chegou, e (sem data_fim OU data_fim ainda não
// passou). "Agendada" (data_inicio no futuro) é um estado que o manager do
// backend também exclui de ativas() -- listado à parte aqui só pra UI não
// confundir "nunca vai valer" com "ainda não começou".
function statusPermissao(permissao: PermissaoUsuario): {
  rotulo: string;
  variante: "success" | "warning" | "muted" | "destructive";
} {
  if (!permissao.ativo) return { rotulo: "Revogada", variante: "destructive" };
  const dataAtual = hoje();
  if (permissao.data_inicio > dataAtual) return { rotulo: "Agendada", variante: "warning" };
  if (permissao.data_fim && permissao.data_fim < dataAtual) {
    return { rotulo: "Expirada", variante: "muted" };
  }
  return { rotulo: "Ativa", variante: "success" };
}

export function PermissoesAdmin() {
  const router = useRouter();
  const { isAdminOps, isLoading: carregandoAuth } = useAuth();
  const { permissoes, isLoading: carregandoPermissoes } = usePermissoes();
  const { usuarios } = useUsuarios();
  const { unidades } = useUnidades();
  const { setores } = useSetores();
  const { revogar, isLoading: revogando } = useRevogarPermissao();

  const [formAberto, setFormAberto] = useState(false);
  const [paraRevogar, setParaRevogar] = useState<PermissaoUsuario | null>(null);

  // Mesmo padrão de guarda de página usado em nenhum outro lugar do app
  // ainda (achado construindo o STC-266: hoje o controle de admin só
  // esconde pedaços de tela, nunca bloqueia uma página inteira) -- backend
  // (IsAdminOperacoes) continua sendo a fonte de verdade real, isso é só
  // pra não deixar a tela "piscar" vazia/quebrada pra quem não tem acesso.
  // Navegação dentro de useEffect, não direto no corpo do render -- fora
  // do effect, chamar router.replace() durante a renderização é efeito
  // colateral no lugar errado (React acusa "Cannot update a component
  // while rendering a different component"). carregandoAuth entra na
  // condição de propósito: isAdminOps nasce false antes da sessão
  // resolver, e sem essa checagem um Admin Operações de verdade seria
  // redirecionado por engano no primeiro render.
  useEffect(() => {
    if (!carregandoAuth && !isAdminOps) {
      router.replace("/modulos/gestao-demandas");
    }
  }, [carregandoAuth, isAdminOps, router]);

  if (carregandoAuth || !isAdminOps) return null;

  function nomeUsuario(usuarioId: number) {
    const usuario = usuarios.find((candidato) => candidato.id === usuarioId);
    return usuario ? nomeExibicao(usuario) : `Usuário #${usuarioId}`;
  }

  function nomeEscopo(permissao: PermissaoUsuario) {
    if (permissao.escopo_tipo === "unidade") {
      return unidades.find((unidade) => unidade.id === permissao.unidade)?.nome ?? "--";
    }
    if (permissao.escopo_tipo === "setor") {
      return setores.find((setor) => setor.id === permissao.setor)?.nome ?? "--";
    }
    return ROTULO_ESCOPO[permissao.escopo_tipo];
  }

  async function confirmarRevogacao() {
    if (!paraRevogar) return;
    try {
      await revogar(paraRevogar.id);
      toast.success("Permissão revogada.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setParaRevogar(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-7">
      <div className="flex items-center justify-between gap-3 pb-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-secondary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Permissões individuais
            </h1>
            <p className="text-sm text-muted-foreground">
              Acesso temporário concedido a uma pessoa específica -- ex.: cobertura de
              férias entre unidades.
            </p>
          </div>
        </div>
        <Button onClick={() => setFormAberto(true)}>
          <Plus className="size-4" />
          Nova permissão
        </Button>
      </div>

      {carregandoPermissoes ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : permissoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma permissão concedida ainda.</p>
      ) : (
        <div className="scrollbar-discreta overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Pessoa</th>
                <th className="px-4 py-2.5">Concedido</th>
                <th className="px-4 py-2.5">Ação</th>
                <th className="px-4 py-2.5">Escopo</th>
                <th className="px-4 py-2.5">Período</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {permissoes.map((permissao) => {
                const status = statusPermissao(permissao);
                return (
                  <tr key={permissao.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {nomeUsuario(permissao.usuario)}
                    </td>
                    {/* Achado no dogfooding: faltava rastro de quem concedeu
                        e quando -- só o período de validade não basta pra
                        auditoria ("quem deu esse acesso pra ela?"). */}
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <div>{nomeUsuario(permissao.concedido_por)}</div>
                      <div className="text-xs">{formatarDataHora(permissao.created_at)}</div>
                    </td>
                    <td className="px-4 py-2.5">{ROTULO_ACAO[permissao.acao]}</td>
                    <td className="px-4 py-2.5">
                      {ROTULO_ESCOPO[permissao.escopo_tipo]}
                      {permissao.escopo_tipo !== "global" &&
                        permissao.escopo_tipo !== "proprio" && (
                          <span className="text-muted-foreground"> -- {nomeEscopo(permissao)}</span>
                        )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatarData(permissao.data_inicio)} até{" "}
                      {permissao.data_fim ? formatarData(permissao.data_fim) : "sem data fim"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={status.variante}>{status.rotulo}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {permissao.ativo && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setParaRevogar(permissao)}
                        >
                          Revogar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <FormNovaPermissao open={formAberto} onOpenChange={setFormAberto} />

      <ConfirmDialog
        open={paraRevogar !== null}
        onOpenChange={(open) => !open && setParaRevogar(null)}
        titulo="Revogar permissão"
        descricao={
          paraRevogar
            ? `Revogar o acesso de ${nomeUsuario(paraRevogar.usuario)}? Isso desativa a permissão imediatamente.`
            : ""
        }
        textoConfirmar="Revogar"
        destrutivo
        isLoading={revogando}
        onConfirmar={() => void confirmarRevogacao()}
      />
    </div>
  );
}
