"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ListFilter, Maximize2, Minimize2, Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePermissoes, useRevogarPermissao } from "@/hooks/usePermissoes";
import { useSetores } from "@/hooks/useSetores";
import { useUnidades } from "@/hooks/useUnidades";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { cn, formatarDataHora, nomeExibicao } from "@/lib/utils";
import type { AcaoPermissao, EscopoPermissao, PermissaoUsuario } from "@/types";
import { FormNovaPermissao } from "./FormNovaPermissao";
import { GerenciarUsuarios, usuariosGerenciaveis } from "./GerenciarUsuarios";

const STATUS_PERMISSAO = ["Ativa", "Agendada", "Expirada", "Revogada"] as const;

type Secao = "usuarios" | "permissoes";

// Achado no dogfooding: 50/50 fixo desperdiçava espaço quando uma seção
// tinha poucas linhas e a outra, mais -- em vez de flex-1 igual pras duas,
// o "peso" (flex-grow) de cada seção acompanha quantas linhas ela realmente
// tem. PESO_MINIMO evita que uma seção vazia suma; PESO_MAXIMO evita que uma
// tabela enorme empurre a outra pra quase nada.
const PESO_MINIMO = 1;
const PESO_MAXIMO = 6;

function pesoSecao(linhas: number) {
  return Math.min(Math.max(linhas, PESO_MINIMO), PESO_MAXIMO);
}

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
// confundir "nunca vai valer" com "ainda não começou". Assinatura aceita um
// subconjunto de campos (em vez de PermissaoUsuario inteiro) pra servir tanto
// uma linha individual quanto um GrupoPermissao.
function statusPermissao(permissao: {
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
}): {
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

interface GrupoPermissao {
  ids: number[];
  usuario: number;
  concedido_por: number;
  escopo_tipo: EscopoPermissao;
  unidade: number | null;
  setor: number | null;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
  acoes: AcaoPermissao[];
}

// Achado no dogfooding: marcar várias Ações num só formulário virava várias
// linhas na tabela (uma por PermissaoUsuario -- no backend, sempre uma ação
// só por registro). Reagrupa pra exibição por tudo que caracteriza "o mesmo
// pedido de acesso" (pessoa, quem concedeu, escopo, período, minuto de
// criação), sem mudar o model: revogar continua granular por ação nos
// bastidores (um DELETE lógico por id), só a apresentação junta em uma
// linha. Se uma ação do grupo for revogada individualmente depois, ela sai
// do grupo sozinha (ativo diferente vira outra chave).
function agruparPermissoes(permissoes: PermissaoUsuario[]): GrupoPermissao[] {
  const grupos = new Map<string, GrupoPermissao>();
  for (const permissao of permissoes) {
    const chave = [
      permissao.usuario,
      permissao.concedido_por,
      permissao.escopo_tipo,
      permissao.unidade,
      permissao.setor,
      permissao.data_inicio,
      permissao.data_fim,
      permissao.ativo,
      permissao.created_at.slice(0, 16), // até o minuto -- mesma granularidade que formatarDataHora exibe
    ].join("|");

    const existente = grupos.get(chave);
    if (existente) {
      existente.ids.push(permissao.id);
      existente.acoes.push(permissao.acao);
    } else {
      grupos.set(chave, {
        ids: [permissao.id],
        usuario: permissao.usuario,
        concedido_por: permissao.concedido_por,
        escopo_tipo: permissao.escopo_tipo,
        unidade: permissao.unidade,
        setor: permissao.setor,
        data_inicio: permissao.data_inicio,
        data_fim: permissao.data_fim,
        ativo: permissao.ativo,
        created_at: permissao.created_at,
        acoes: [permissao.acao],
      });
    }
  }
  // Mais recente primeiro -- ordem de criação (API não garante nenhuma
  // ordem específica), não a de qualquer outro campo do grupo.
  return Array.from(grupos.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function PermissoesAdmin() {
  const router = useRouter();
  const { isAdminOps, isLoading: carregandoAuth } = useAuth();
  // Mesmo critério do KanbanFiltros (STC-186): abaixo de 640px, os selects
  // de filtro saem de linha e vão pra dentro de um Popover atrás de um
  // botão só, com badge de contagem -- evita empilhar campo atrás de campo
  // antes do usuário ver qualquer linha da tabela.
  const ehMobile = useMediaQuery("(max-width: 639px)");
  const { permissoes, isLoading: carregandoPermissoes } = usePermissoes();
  const { usuarios } = useUsuarios();
  const { unidades } = useUnidades();
  const { setores } = useSetores();
  const { revogar, isLoading: revogando } = useRevogarPermissao();

  const [formAberto, setFormAberto] = useState(false);
  const [paraRevogar, setParaRevogar] = useState<GrupoPermissao | null>(null);
  // Achado no dogfooding: com muitos usuários, "Perfil, unidade e setor"
  // (tabela sem paginação) empurrava "Permissões individuais" pra fora da
  // tela. null = as duas seções dividem a altura disponível proporcional ao
  // que cada uma tem (ver pesoSecao), cada uma com scroll próprio;
  // "usuarios"/"permissoes" = essa seção ocupa o espaço das duas, a outra
  // fica oculta (mas continua montada -- volta do jeito que estava ao
  // desfazer).
  const [secaoExpandida, setSecaoExpandida] = useState<Secao | null>(null);

  function alternarExpansao(secao: Secao) {
    setSecaoExpandida((atual) => (atual === secao ? null : secao));
  }

  // Filtros -- só do lado do cliente: usePermissoes() já carrega tudo de
  // uma vez (sem paginação), então filtrar em memória é suficiente e evita
  // ir e voltar no backend a cada troca de filtro.
  const [filtroStatus, setFiltroStatus] = useState("todos");
  // Pessoa é multi-seleção (achado no dogfooding: útil comparar duas
  // pessoas de uma vez) -- array vazio = sem filtro, não "todas" como um
  // valor mágico, já que aqui não existe um "valor único" pra representar
  // isso.
  const [filtroPessoas, setFiltroPessoas] = useState<number[]>([]);
  const [filtroAcao, setFiltroAcao] = useState("todas");

  const grupos = agruparPermissoes(permissoes);
  // Peso das seções (ver pesoSecao) segue o total real, não o filtrado --
  // senão a proporção "pula" a cada troca de filtro, mesmo com a mesma
  // quantidade de dados por trás.
  const pesoUsuarios = pesoSecao(usuariosGerenciaveis(usuarios).length);
  const pesoPermissoes = pesoSecao(grupos.length);
  // Achado no dogfooding: listar TODOS os usuários no filtro de pessoa
  // mostrava gente que nunca recebeu nenhuma permissão -- opções demais,
  // a maioria inútil. Deriva de "grupos" (não filtrado por outros campos
  // de propósito: trocar Status/Ação não deve fazer pessoas sumirem da
  // lista de opções, senão fica confuso qual filtro mexeu em qual).
  const idsComPermissao = Array.from(new Set(grupos.map((grupo) => grupo.usuario))).sort((a, b) =>
    nomeUsuario(a).localeCompare(nomeUsuario(b)),
  );
  const gruposFiltrados = grupos.filter((grupo) => {
    if (filtroStatus !== "todos" && statusPermissao(grupo).rotulo !== filtroStatus) return false;
    if (filtroPessoas.length > 0 && !filtroPessoas.includes(grupo.usuario)) return false;
    if (filtroAcao !== "todas" && !grupo.acoes.includes(filtroAcao as AcaoPermissao)) {
      return false;
    }
    return true;
  });
  const contagemFiltrosPermissoes = [
    filtroStatus !== "todos",
    filtroPessoas.length > 0,
    filtroAcao !== "todas",
  ].filter(Boolean).length;

  function limparFiltrosPermissoes() {
    setFiltroStatus("todos");
    setFiltroPessoas([]);
    setFiltroAcao("todas");
  }

  function alternarFiltroPessoa(usuarioId: number) {
    setFiltroPessoas((atual) =>
      atual.includes(usuarioId)
        ? atual.filter((id) => id !== usuarioId)
        : [...atual, usuarioId],
    );
  }

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

  function nomeEscopo(permissao: {
    escopo_tipo: EscopoPermissao;
    unidade: number | null;
    setor: number | null;
  }) {
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
      // Sequencial (não Promise.all) -- useRevogarPermissao(), assim como
      // useCriarPermissao(), tem um isMutating/error compartilhado por
      // instância do hook; disparar em paralelo arrisca pisar nesse estado.
      for (const id of paraRevogar.ids) {
        await revogar(id);
      }
      toast.success(paraRevogar.ids.length > 1 ? "Permissões revogadas." : "Permissão revogada.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setParaRevogar(null);
    }
  }

  // Extraído pra função (não JSX inline duas vezes): os mesmos 3 selects
  // renderizam inline (desktop) ou dentro do Popover (mobile), mesmo
  // critério do KanbanFiltros -- reaproveita a árvore em vez de duplicar
  // <Select>/aria-label nos dois branches.
  function camposDeFiltroPermissoes() {
    return (
      <>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_PERMISSAO.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Multi-seleção: mesmo padrão do campo "Ação" em FormNovaPermissao
            (Popover + Checkbox, estilizado feito um SelectTrigger) -- o
            primitivo Select do Radix não suporta múltiplos valores. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Pessoa"
              className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm whitespace-nowrap shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto dark:bg-input/30 dark:hover:bg-input/50"
            >
              <span
                className={cn(
                  "line-clamp-1 text-left",
                  filtroPessoas.length === 0 && "text-muted-foreground",
                )}
              >
                {filtroPessoas.length > 0
                  ? filtroPessoas.map((id) => nomeUsuario(id)).join(", ")
                  : "Pessoa"}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground opacity-50" />
            </button>
          </PopoverTrigger>
          {/* min-w: achado no dogfooding -- preso só a
              --radix-popover-trigger-width, o botão "Pessoa" (estreito
              antes de escolher alguém) fazia nomes mais longos ("Projetos
              BR MED") quebrarem linha dentro do popover e "descolarem" do
              checkbox. shrink-0 no Checkbox + truncate no texto garantem
              uma linha só mesmo assim. */}
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-48 p-1">
            {idsComPermissao.map((id) => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={filtroPessoas.includes(id)}
                  onCheckedChange={() => alternarFiltroPessoa(id)}
                  className="shrink-0"
                />
                <span className="truncate">{nomeUsuario(id)}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Select value={filtroAcao} onValueChange={setFiltroAcao}>
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Ação">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {(Object.keys(ROTULO_ACAO) as AcaoPermissao[]).map((acao) => (
              <SelectItem key={acao} value={acao}>
                {ROTULO_ACAO[acao]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {contagemFiltrosPermissoes > 0 && (
          <button
            type="button"
            onClick={limparFiltrosPermissoes}
            className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
          >
            <X className="size-3.5" />
            Limpar filtros
          </button>
        )}
      </>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-7">
      <div className="flex items-center gap-2.5 pb-7">
        <ShieldCheck className="size-5 shrink-0 text-secondary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Administração de usuários</h1>
          <p className="text-sm text-muted-foreground">
            Cargo, lotação e acessos de cada pessoa.
          </p>
        </div>
      </div>

      {/* Cada seção reparte a altura disponível proporcional a quantas
          linhas tem (flex-grow via style, ver pesoSecao) e rola por conta
          própria -- uma tabela grande nunca empurra a outra seção pra fora
          da tela, e uma seção rala não fica com metade da tela vazia.
          min-h-[15rem] (não min-h-0): achado no dogfooding -- com uma
          diferença grande de linhas (ex.: 2 vs 19), o peso proporcional
          sozinho espremia a seção menor abaixo da altura do próprio
          cabeçalho (só sobrava espaço pro <thead>, nem uma linha). O piso
          garante cabeçalho + ~2 linhas visíveis antes de precisar rolar,
          não importa quão desigual seja a proporção; o espaço extra além
          dos dois pisos continua sendo repartido pelo peso.
          Expandida, uma toma o espaço das duas e a outra leva "hidden"
          (fica montada, só invisível: preserva scroll/estado ao desfazer).
          min-w-0 em toda a cadeia: achado testando em telas estreitas -- a
          tabela de dentro tem min-w-[Npx] pra rolar horizontalmente (mesmo
          princípio do Kanban, STC-186), mas sem min-w-0 esse mínimo
          "vaza" pro pai (mesmo bug do min-height:auto que motivou o
          min-h-0 acima, só que no eixo horizontal) e empurra a coluna
          inteira mais larga que a viewport -- o cabeçalho quebra
          palavra-por-palavra e a página ganha scroll horizontal fantasma. */}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-7">
        <div
          data-testid="secao-usuarios"
          className={cn(
            "flex min-h-[15rem] min-w-0 flex-col",
            secaoExpandida === "permissoes" ? "hidden" : "flex-1",
          )}
          style={{ flexGrow: pesoUsuarios }}
        >
          {/* STC-266 (extensão): a tela nasceu só com PermissaoUsuario
              (acessos extras pontuais). Faltava a parte "estrutural" --
              Perfil/Unidade/Setor da pessoa -- que hoje só existia no
              Django Admin, mesmo o backend (UsuarioViewSet) já aceitando
              Admin Operações editar isso via API. */}
          <GerenciarUsuarios
            expandido={secaoExpandida === "usuarios"}
            onAlternarExpandir={() => alternarExpansao("usuarios")}
          />
        </div>

        {secaoExpandida === null && <div className="h-px shrink-0 bg-border" />}

        <div
          data-testid="secao-permissoes"
          className={cn(
            "flex min-h-[15rem] min-w-0 flex-col",
            secaoExpandida === "usuarios" ? "hidden" : "flex-1",
          )}
          style={{ flexGrow: pesoPermissoes }}
        >
          <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Permissões individuais</h2>
              <p className="text-sm text-muted-foreground">
                Acesso extra a um recurso específico -- temporário ou não -- ex.: cobertura de
                férias entre unidades.
              </p>
            </div>
            {/* self-end (só até sm:): achado no dogfooding -- empilhado em
                tela estreita, esse grupo ficava colado à esquerda enquanto
                o botão de expandir da outra seção (sozinho, com o mesmo
                self-end) ia pro canto direito -- os dois desalinhados
                entre si. */}
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <Button onClick={() => setFormAberto(true)}>
                <Plus className="size-4" />
                Nova permissão
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => alternarExpansao("permissoes")}
                aria-label={
                  secaoExpandida === "permissoes"
                    ? "Recolher Permissões individuais"
                    : "Expandir Permissões individuais"
                }
              >
                {secaoExpandida === "permissoes" ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {!carregandoPermissoes && grupos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pb-3">
              {ehMobile ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="relative shrink-0">
                      <ListFilter className="size-4" />
                      <span className="sr-only">Filtros</span>
                      {contagemFiltrosPermissoes > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]"
                        >
                          {contagemFiltrosPermissoes}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="flex flex-col gap-2">
                    {camposDeFiltroPermissoes()}
                  </PopoverContent>
                </Popover>
              ) : (
                camposDeFiltroPermissoes()
              )}
            </div>
          )}

          {carregandoPermissoes ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma permissão concedida ainda.</p>
          ) : gruposFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma permissão encontrada com esses filtros.
            </p>
          ) : (
            <div className="scrollbar-discreta scroll-fade-x min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border">
              <table
                aria-label="Permissões individuais"
                className="w-full min-w-[720px] text-left text-sm"
              >
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
                  {gruposFiltrados.map((grupo) => {
                    const status = statusPermissao(grupo);
                    return (
                      <tr
                        key={grupo.ids.join("-")}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {nomeUsuario(grupo.usuario)}
                        </td>
                        {/* Achado no dogfooding: faltava rastro de quem
                            concedeu e quando -- só o período de validade não
                            basta pra auditoria ("quem deu esse acesso pra
                            ela?"). */}
                        <td className="px-4 py-2.5 text-muted-foreground">
                          <div>{nomeUsuario(grupo.concedido_por)}</div>
                          <div className="text-xs">{formatarDataHora(grupo.created_at)}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {grupo.acoes.map((acao) => ROTULO_ACAO[acao]).join(", ")}
                        </td>
                        <td className="px-4 py-2.5">
                          {ROTULO_ESCOPO[grupo.escopo_tipo]}
                          {grupo.escopo_tipo !== "global" && grupo.escopo_tipo !== "proprio" && (
                            <span className="text-muted-foreground"> -- {nomeEscopo(grupo)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {grupo.data_fim
                            ? `${formatarData(grupo.data_inicio)} até ${formatarData(grupo.data_fim)}`
                            : `A partir de ${formatarData(grupo.data_inicio)}`}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={status.variante}>{status.rotulo}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {grupo.ativo && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setParaRevogar(grupo)}
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
        </div>
      </div>

      <FormNovaPermissao open={formAberto} onOpenChange={setFormAberto} />

      <ConfirmDialog
        open={paraRevogar !== null}
        onOpenChange={(open) => !open && setParaRevogar(null)}
        titulo="Revogar permissão"
        descricao={
          paraRevogar
            ? `Revogar o acesso de ${nomeUsuario(paraRevogar.usuario)}? Isso desativa ${
                paraRevogar.ids.length > 1 ? "as permissões" : "a permissão"
              } imediatamente.`
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
