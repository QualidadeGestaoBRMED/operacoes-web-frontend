"use client";

import { useState } from "react";
import { Eye, ListFilter, Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "sonner";
import { CabecalhoOrdenavel } from "@/components/CabecalhoOrdenavel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuth } from "@/hooks/useAuth";
import { usePerfis } from "@/hooks/usePerfis";
import { useSetores } from "@/hooks/useSetores";
import { useUnidades } from "@/hooks/useUnidades";
import { useAtualizarUsuario, useUsuarios } from "@/hooks/useUsuarios";
import { iniciarVerComo } from "@/lib/plataforma";
import { extrairMensagemErro } from "@/lib/erros";
import { ordenarPor, proximaOrdenacao, type Ordenacao } from "@/lib/ordenacao";
import {
  NIVEL_ADMIN_QG,
  administra,
  descricaoDoCargo,
  eCargoAdministrativo,
  podeAtribuirCargo,
  podeGerenciar,
  redeDoCargoDeUnidade,
  redeDoUsuario,
} from "@/lib/redes";
import { cn, nomeExibicao } from "@/lib/utils";
import { guardarVerComo } from "@/lib/verComo";
import type { Perfil, Unidade, Usuario } from "@/types";

// Quem cada Admin gerencia e que cargos oferece seguem as regras do backend
// (STC-745, espelhadas em lib/redes.ts): cada Admin cuida dos usuários da
// rede dele; cargos administrativos só por quem pode atribuí-los (Admin Q&G
// atribui todos; Gestão de Operações, os dois Admins de rede). A própria
// conta não aparece: tirar o próprio cargo administrativo é recusado.

// Sentinel: Radix Select não aceita value="" num SelectItem (colide com o
// estado interno "sem valor selecionado"). "nenhum" representa null nos três
// selects (perfil/unidade/setor podem ser desvinculados).
const SEM_VALOR = "nenhum";

type CampoUsuarios = "pessoa" | "perfil" | "unidade" | "setor";

const COLUNAS_USUARIOS: { campo: CampoUsuarios; rotulo: string }[] = [
  { campo: "pessoa", rotulo: "Pessoa" },
  { campo: "perfil", rotulo: "Perfil" },
  { campo: "unidade", rotulo: "Unidade" },
  { campo: "setor", rotulo: "Setor" },
];

// Exportada pra PermissoesAdmin conseguir contar quantas linhas essa seção
// vai renderizar (ver "peso" de altura das duas seções) sem duplicar a regra
// de quem entra na lista.
export function usuariosGerenciaveis(
  usuarios: Usuario[],
  ator: AtorDaAdministracao | null | undefined,
  unidades: Unidade[],
): Usuario[] {
  const porId = new Map(unidades.map((unidade) => [unidade.id, unidade]));
  return usuarios.filter(
    (usuario) =>
      usuario.id !== ator?.usuarioId &&
      podeGerenciar(ator, usuario.perfil, porId.get(usuario.unidade_id ?? -1)),
  );
}

// Opção de cargo com a descrição embaixo. O nome acessível da opção
// continua só o nome do cargo; a descrição chega ao leitor de tela como
// descrição da opção (aria-describedby). Só uma lista de cargos fica aberta
// por vez, então o id não se repete na página.
function opcaoDeCargo(perfil: Perfil) {
  const descricao = descricaoDoCargo(perfil);
  const idDescricao = `descricao-cargo-${perfil.id}`;
  return (
    <SelectItem
      key={perfil.id}
      value={String(perfil.id)}
      aria-describedby={descricao ? idDescricao : undefined}
    >
      <span className="flex flex-col items-start">
        <span>{perfil.nome}</span>
        {descricao && (
          <span id={idDescricao} aria-hidden className="text-xs whitespace-normal opacity-70">
            {descricao}
          </span>
        )}
      </span>
    </SelectItem>
  );
}

type AtorDaAdministracao = {
  perfil?: Perfil | null;
  redes_administradas?: Usuario["redes_administradas"];
  usuarioId?: number;
};

/** Cargos que o ator pode dar: os administrativos por quem pode atribuir;
 * os demais, se ele administra a rede do cargo. */
export function cargosAtribuiveis(perfis: Perfil[], ator: AtorDaAdministracao | null | undefined) {
  return perfis.filter((perfil) =>
    eCargoAdministrativo(perfil)
      ? podeAtribuirCargo(ator, perfil)
      : administra(ator, redeDoUsuario(perfil, null) ?? "padrao"),
  );
}

export function GerenciarUsuarios({
  expandido,
  onAlternarExpandir,
}: {
  expandido: boolean;
  onAlternarExpandir: () => void;
}) {
  const { user: ator, redesAdministradas, administraRedePadrao, isAdminQG } = useAuth();
  const { usuarios, isLoading: carregandoUsuarios, error: erroUsuarios } = useUsuarios();
  const { perfis, isLoading: carregandoPerfis, error: erroPerfis } = usePerfis();
  // Todas as redes: cada linha oferece as unidades da rede do cargo dela.
  const { unidades, isLoading: carregandoUnidades, error: erroUnidades } = useUnidades();
  const { setores } = useSetores();
  const { atualizar } = useAtualizarUsuario();
  // Mesmo critério do KanbanFiltros (STC-186): abaixo de 640px, os selects
  // de filtro saem de linha e vão pra dentro de um Popover atrás de um
  // botão só, com badge de contagem.
  const ehMobile = useMediaQuery("(max-width: 639px)");
  const { refPai, refTabela, maxHeight } = useAlturaSemLinhaCortada();

  // Quem entra na lista depende da rede da unidade de cada pessoa, e os
  // cargos de cada linha, de quem edita: sem unidades e cargos, a tabela
  // ainda não está decidida.
  const carregando = carregandoUsuarios || carregandoUnidades || carregandoPerfis;
  const comErro = Boolean(erroUsuarios || erroUnidades || erroPerfis);
  const perfisDisponiveis = cargosAtribuiveis(perfis, ator);
  const usuariosListados = usuariosGerenciaveis(usuarios, ator, unidades);
  const unidadesDasMinhasRedes = unidades.filter((unidade) =>
    redesAdministradas.includes(unidade.rede),
  );

  // Unidades oferecidas na linha: as da rede do cargo (Unidade, clínica;
  // Ponto focal, aeroclínica), entre as redes que o ator administra.
  function unidadesDaLinha(usuario: Usuario) {
    const rede = redeDoCargoDeUnidade(usuario.perfil);
    return rede
      ? unidadesDasMinhasRedes.filter((unidade) => unidade.rede === rede)
      : unidadesDasMinhasRedes;
  }

  // Filtros -- só do lado do cliente: useUsuarios() já carrega tudo de uma
  // vez (sem paginação), então filtrar em memória é suficiente.
  const [filtroPerfil, setFiltroPerfil] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");

  const usuariosFiltrados = usuariosListados.filter((usuario) => {
    if (filtroPerfil !== "todos") {
      const valorPerfil = usuario.perfil ? String(usuario.perfil.id) : SEM_VALOR;
      if (valorPerfil !== filtroPerfil) return false;
    }
    if (filtroUnidade !== "todas") {
      const valorUnidade = usuario.unidade_id ? String(usuario.unidade_id) : SEM_VALOR;
      if (valorUnidade !== filtroUnidade) return false;
    }
    return true;
  });
  // Sem coluna escolhida, vale a ordem da API.
  const [ordenacao, setOrdenacao] = useState<Ordenacao<CampoUsuarios> | null>(null);
  const usuariosOrdenados = ordenarPor(usuariosFiltrados, ordenacao, {
    pessoa: (usuario) => nomeExibicao(usuario),
    perfil: (usuario) => usuario.perfil?.nome ?? null,
    unidade: (usuario) => unidades.find((unidade) => unidade.id === usuario.unidade_id)?.nome ?? null,
    setor: (usuario) => setores.find((setor) => setor.id === usuario.setor_id)?.nome ?? null,
  });
  const contagemFiltros = [filtroPerfil !== "todos", filtroUnidade !== "todas"].filter(
    Boolean,
  ).length;

  function limparFiltros() {
    setFiltroPerfil("todos");
    setFiltroUnidade("todas");
  }

  function camposDeFiltro() {
    return (
      <>
        <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Filtrar por perfil">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            <SelectItem value={SEM_VALOR}>Sem perfil</SelectItem>
            {perfisDisponiveis.map((perfil) => (
              <SelectItem key={perfil.id} value={String(perfil.id)}>
                {perfil.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Filtrar por unidade"
          >
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as unidades</SelectItem>
            <SelectItem value={SEM_VALOR}>Sem unidade</SelectItem>
            {unidadesDasMinhasRedes.map((unidade) => (
              <SelectItem key={unidade.id} value={String(unidade.id)}>
                {unidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {contagemFiltros > 0 && (
          <button
            type="button"
            onClick={limparFiltros}
            className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
          >
            <X className="size-3.5" />
            Limpar filtros
          </button>
        )}
      </>
    );
  }

  // "Ver como" (STC-790): só o Admin Q&G, e não de outro Admin Q&G (o
  // backend recusa os mesmos casos). Começa e recarrega a página já como a
  // pessoa, sem nada do que estava em cache como o Admin.
  function podeVerComo(usuario: Usuario) {
    return usuario.ativo && usuario.perfil != null && usuario.perfil.nivel !== NIVEL_ADMIN_QG;
  }

  async function verComo(usuario: Usuario) {
    try {
      guardarVerComo(await iniciarVerComo(usuario.id));
      window.location.assign("/modulos/gestao-demandas");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function aoMudarPerfil(usuario: Usuario, valor: string) {
    const novo = perfis.find((perfil) => String(perfil.id) === valor) ?? null;
    // Cargo de outra rede que a da unidade atual (ex.: Unidade para Ponto
    // focal): a unidade sai junto, senão o backend recusa a combinação e
    // nenhuma das duas mudanças, feita sozinha, passaria. A unidade nova é
    // escolhida em seguida, já entre as da rede certa.
    const redeExigida = redeDoCargoDeUnidade(novo);
    // Unidade fora da lista (desativada) tem rede desconhecida: sai também.
    const unidadeAtual = unidades.find((unidade) => unidade.id === usuario.unidade_id);
    const tiraUnidade =
      redeExigida !== null &&
      usuario.unidade_id != null &&
      unidadeAtual?.rede !== redeExigida;
    try {
      await atualizar({
        id: usuario.id,
        payload: {
          perfil_id: novo?.id ?? null,
          ...(tiraUnidade && { unidade_id: null }),
        },
      });
      toast.success("Perfil atualizado.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function aoMudarUnidade(usuario: Usuario, valor: string) {
    try {
      await atualizar({
        id: usuario.id,
        payload: { unidade_id: valor === SEM_VALOR ? null : Number(valor) },
      });
      toast.success("Unidade atualizada.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function aoMudarSetor(usuario: Usuario, valor: string) {
    try {
      await atualizar({
        id: usuario.id,
        payload: { setor_id: valor === SEM_VALOR ? null : Number(valor) },
      });
      toast.success("Setor atualizado.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <div ref={refPai} className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="pb-2">
        <h2 className="text-base font-semibold text-foreground">Perfil, unidade e setor</h2>
        <p className="text-sm text-muted-foreground">
          Define o cargo e a lotação base de cada pessoa -- diferente das permissões
          individuais abaixo, isso vale enquanto não for alterado de novo (sem período).
        </p>
      </div>

      {/* Achado no dogfooding: filtros e botão de expandir numa linha só
          (não cabeçalho+botão numa linha e filtros noutra) -- mesmo
          critério do KanbanFiltros (o "Nova Demanda" mora na própria
          linha dos filtros, não no cabeçalho da página) e economiza uma
          linha inteira de altura, principalmente em mobile. */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {usuariosListados.length > 0 &&
          (ehMobile ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative shrink-0">
                  <ListFilter className="size-4" />
                  <span className="sr-only">Filtros</span>
                  {contagemFiltros > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]"
                    >
                      {contagemFiltros}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="flex flex-col gap-2">
                {camposDeFiltro()}
              </PopoverContent>
            </Popover>
          ) : (
            camposDeFiltro()
          ))}
        <Button
          variant="outline"
          size="icon"
          onClick={onAlternarExpandir}
          aria-label={
            expandido ? "Recolher Perfil, unidade e setor" : "Expandir Perfil, unidade e setor"
          }
          className="ml-auto shrink-0"
        >
          {expandido ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : comErro ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os usuários -- tente novamente.
        </p>
      ) : usuariosListados.length === 0 ? (
        // Ex.: Admin Operações Especiais antes de cadastrar os pontos focais.
        <p className="text-sm text-muted-foreground">
          Nenhuma pessoa da sua rede para gerenciar ainda.
        </p>
      ) : usuariosFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada com esses filtros.</p>
      ) : (
        /* min-w-0: mesmo achado de PermissoesAdmin -- sem isso, o
            min-w-[640px] da tabela abaixo vaza pro pai e força a coluna
            inteira mais larga que a viewport em telas estreitas, em vez de
            só essa caixa rolar horizontalmente.

            ehMobile ? undefined : {maxHeight} / !ehMobile && "overflow-y-auto":
            achado testando em celular real (STC-505) -- diferente de
            CatalogoLegalizacaoAdmin.tsx (que já tinha esse tratamento),
            esta tabela travava a própria altura o tempo todo, mesmo no
            mobile. Sem sobrar espaço suficiente na tela pra caber tabela +
            "Permissões individuais" abaixo, e sem nenhum scroll de página
            pra compensar, a rolagem simplesmente não tinha pra onde ir --
            parecia travada. No mobile a tabela mostra tudo (sem altura
            travada) e quem rola é a aba inteira (overflow-y-auto adicionado
            no wrapper da aba, PermissoesAdmin.tsx); overflow-x-auto
            continua sempre ligado -- é o que a coluna fixa (sticky left)
            precisa pra rolar horizontalmente. */
        <div
          ref={refTabela}
          style={ehMobile ? undefined : { maxHeight }}
          className={cn(
            "scrollbar-discreta scroll-fade-x min-h-0 min-w-0 flex-1 overflow-x-auto rounded-lg border border-border",
            !ehMobile && "overflow-y-auto",
          )}
        >
          <table
            aria-label="Perfil, unidade e setor"
            className={cn(
              "w-full text-left text-sm",
              isAdminQG ? "min-w-[760px]" : "min-w-[640px]",
            )}
          >
            {/* sticky: mesmo achado de PermissoesAdmin -- sem isso, rolar a
                tabela escondia os rótulos das colunas junto com as linhas.
                bg-muted sólido (não /40): translúcido deixaria as linhas
                por baixo aparecerem por trás do header ao rolar. */}
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {/* sticky left-0 + z-20: achado testando no mobile (STC-505)
                    -- tabela de 4 colunas ficava larga demais pra tela
                    estreita, e rolar pro lado escondia "Pessoa" junto com o
                    resto, tirando o contexto de qual linha é qual. Fixa só a
                    coluna mais importante fora do scroll horizontal, mesmo
                    espírito do sticky top já usado pro cabeçalho. bg-muted
                    próprio (não herdado do <tr>): sem isso a célula fica
                    transparente quando o resto da linha rola por baixo.
                    z-20 (maior que o z-10 do <thead>): garante que o canto
                    fixo nos dois eixos fique acima das outras células do
                    cabeçalho, que só são fixas no eixo vertical. */}
                {COLUNAS_USUARIOS.map((coluna) => (
                  <CabecalhoOrdenavel
                    key={coluna.campo}
                    campo={coluna.campo}
                    rotulo={coluna.rotulo}
                    ordenacao={ordenacao}
                    onOrdenar={(campo) => setOrdenacao((atual) => proximaOrdenacao(atual, campo))}
                    className={cn(
                      "px-4 py-2.5",
                      coluna.campo === "pessoa" && "sticky left-0 z-20 bg-muted",
                    )}
                  />
                ))}
                {isAdminQG && (
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Ver como</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {usuariosOrdenados.map((usuario) => (
                <tr key={usuario.id} className="border-b border-border last:border-0">
                  {/* bg-background próprio: mesmo achado do cabeçalho acima
                      -- sem isso, as outras colunas apareceriam por baixo
                      desta ao rolar horizontalmente. */}
                  <td className="sticky left-0 z-[1] bg-background px-4 py-2.5 font-medium text-foreground">
                    {nomeExibicao(usuario)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={usuario.perfil ? String(usuario.perfil.id) : SEM_VALOR}
                      onValueChange={(valor) => void aoMudarPerfil(usuario, valor)}
                    >
                      <SelectTrigger
                        aria-label={`Alterar perfil de ${nomeExibicao(usuario)}`}
                        className="w-full min-w-[10rem]"
                      >
                        {/* Só o nome no campo; a descrição fica na lista. */}
                        <SelectValue placeholder="Sem perfil">
                          {usuario.perfil?.nome ?? "Sem perfil"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-w-80">
                        <SelectItem value={SEM_VALOR}>Sem perfil</SelectItem>
                        {usuario.perfil &&
                          !perfisDisponiveis.some((p) => p.id === usuario.perfil!.id) &&
                          opcaoDeCargo(usuario.perfil)}
                        {perfisDisponiveis.map(opcaoDeCargo)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={usuario.unidade_id ? String(usuario.unidade_id) : SEM_VALOR}
                      onValueChange={(valor) => void aoMudarUnidade(usuario, valor)}
                    >
                      <SelectTrigger
                        aria-label={`Alterar unidade de ${nomeExibicao(usuario)}`}
                        className="w-full min-w-[10rem]"
                      >
                        <SelectValue placeholder="Sem unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VALOR}>Sem unidade</SelectItem>
                        {/* A unidade atual entra mesmo fora da lista (desativada,
                            ou de cargo antigo), para o campo não aparecer vazio. */}
                        {usuario.unidade_id &&
                          !unidadesDaLinha(usuario).some((u) => u.id === usuario.unidade_id) && (
                            <SelectItem value={String(usuario.unidade_id)}>
                              {unidades.find((u) => u.id === usuario.unidade_id)?.nome ??
                                "Unidade atual"}
                            </SelectItem>
                          )}
                        {unidadesDaLinha(usuario).map((unidade) => (
                          <SelectItem key={unidade.id} value={String(unidade.id)}>
                            {unidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    {/* Setor não tem rede: é da rede padrão (STC-745). */}
                    <Select
                      value={usuario.setor_id ? String(usuario.setor_id) : SEM_VALOR}
                      onValueChange={(valor) => void aoMudarSetor(usuario, valor)}
                      disabled={!administraRedePadrao}
                    >
                      <SelectTrigger
                        aria-label={`Alterar setor de ${nomeExibicao(usuario)}`}
                        className="w-full min-w-[10rem]"
                      >
                        <SelectValue placeholder="Sem setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VALOR}>Sem setor</SelectItem>
                        {setores.map((setor) => (
                          <SelectItem key={setor.id} value={String(setor.id)}>
                            {setor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {isAdminQG && (
                    <td className="px-4 py-2.5 text-right">
                      {podeVerComo(usuario) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void verComo(usuario)}
                          aria-label={`Ver como ${nomeExibicao(usuario)}`}
                          title="Ver o Atlas como esta pessoa, só para leitura"
                        >
                          <Eye className="size-4" />
                          Ver como
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
