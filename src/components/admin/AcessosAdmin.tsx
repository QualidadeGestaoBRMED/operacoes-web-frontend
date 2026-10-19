"use client";

import { useState } from "react";
import { ListFilter, X } from "lucide-react";
import { AvatarUsuario } from "@/components/AvatarUsuario";
import { CabecalhoOrdenavel } from "@/components/CabecalhoOrdenavel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcessos } from "@/hooks/useAcessos";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUsuarios } from "@/hooks/useUsuarios";
import {
  DIAS_SEM_ENTRAR_EM_DESTAQUE,
  PERIODOS_DE_ACESSO,
  diasNoPeriodo,
  emDestaque,
  formatarDataCurta,
  lotacao,
  mesesDoPeriodo,
  rotuloDoUltimoUso,
  rotuloDosDiasSemEntrar,
} from "@/lib/acessos";
import { ordenarPor, proximaOrdenacao, type Ordenacao } from "@/lib/ordenacao";
import { cn, iniciaisDe } from "@/lib/utils";
import type { ReferenciaPorNome, UsuarioAcesso } from "@/types";

// Sentinel: Radix Select não aceita value="" num SelectItem.
const SEM_VALOR = "nenhum";
const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

type CampoAcessos = "pessoa" | "semEntrar" | "ultimoUso" | "diasComUso" | "perfil" | "lotacao";

// Quem nunca entrou conta como o maior "sem entrar" e o uso mais antigo,
// não como vazio: senão iria para o fim nas duas direções.
const CHAVES_DE_ORDENACAO = {
  pessoa: (usuario: UsuarioAcesso) => usuario.nome,
  semEntrar: (usuario: UsuarioAcesso) => usuario.dias_desde_o_ultimo_uso ?? Number.MAX_SAFE_INTEGER,
  ultimoUso: (usuario: UsuarioAcesso) => usuario.ultimo_uso ?? "",
  diasComUso: (usuario: UsuarioAcesso) => usuario.dias_com_uso,
  perfil: (usuario: UsuarioAcesso) => usuario.perfil?.nome ?? null,
  lotacao: (usuario: UsuarioAcesso) => lotacao(usuario),
};

const COLUNAS: { campo: CampoAcessos; rotulo: string; className?: string }[] = [
  { campo: "pessoa", rotulo: "Pessoa", className: "sticky left-0 z-20 bg-muted" },
  { campo: "semEntrar", rotulo: "Sem entrar" },
  { campo: "ultimoUso", rotulo: "Último uso" },
  { campo: "diasComUso", rotulo: "Dias com uso", className: "text-right" },
  { campo: "perfil", rotulo: "Perfil" },
  { campo: "lotacao", rotulo: "Unidade ou setor" },
];

/** Opções de um filtro a partir das próprias linhas, sem repetir, por nome. */
function opcoes(referencias: (ReferenciaPorNome | null)[]) {
  const porId = new Map<number, ReferenciaPorNome>();
  for (const referencia of referencias) if (referencia) porId.set(referencia.id, referencia);
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Acessos (STC-746): último uso de cada pessoa que o Admin administra, para
 * acompanhar a adesão ao Atlas. A lista e o período vêm da API (STC-744); os
 * filtros de perfil e unidade são aplicados na tela, sobre o que já veio.
 */
export function AcessosAdmin({ hidden }: { hidden: boolean }) {
  const [dias, setDias] = useState<number>(PERIODOS_DE_ACESSO[0].dias);
  const { acessos, carregandoPrimeiraVez, trocandoPeriodo, error, recarregar } =
    useAcessos(dias);
  // A foto do Google vem da lista de usuários (a mesma da seção Usuários,
  // em cache), não da rota de acessos. Sem ela, as iniciais.
  const { usuarios: listaDeUsuarios } = useUsuarios();
  const fotoPorId = new Map(listaDeUsuarios.map((usuario) => [usuario.id, usuario.foto_url]));
  const [filtroPerfil, setFiltroPerfil] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [detalhe, setDetalhe] = useState<UsuarioAcesso | null>(null);
  // Sem coluna escolhida, vale a ordem da API: quem nunca entrou, depois
  // quem está há mais tempo sem entrar.
  const [ordenacao, setOrdenacao] = useState<Ordenacao<CampoAcessos> | null>(null);
  // Mesmo critério do GerenciarUsuarios: abaixo de 640px, os filtros vão
  // para um Popover atrás de um botão só.
  const ehMobile = useMediaQuery("(max-width: 639px)");

  const usuarios = acessos?.usuarios ?? [];
  const perfis = opcoes(usuarios.map((usuario) => usuario.perfil));
  const unidades = opcoes(usuarios.map((usuario) => usuario.unidade));
  const filtrados = ordenarPor(usuarios, ordenacao, CHAVES_DE_ORDENACAO).filter((usuario) => {
    if (filtroPerfil !== "todos" && String(usuario.perfil?.id ?? SEM_VALOR) !== filtroPerfil)
      return false;
    if (filtroUnidade !== "todas" && String(usuario.unidade?.id ?? SEM_VALOR) !== filtroUnidade)
      return false;
    return true;
  });
  const emDestaqueNaLista = filtrados.filter(emDestaque).length;
  const contagemFiltros = [filtroPerfil !== "todos", filtroUnidade !== "todas"].filter(
    Boolean,
  ).length;
  const totalDeDias = acessos ? diasNoPeriodo(acessos.periodo.inicio, acessos.periodo.fim) : dias;

  function camposDeFiltro() {
    return (
      <>
        <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Filtrar por perfil">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            <SelectItem value={SEM_VALOR}>Sem perfil</SelectItem>
            {perfis.map((perfil) => (
              <SelectItem key={perfil.id} value={String(perfil.id)}>
                {perfil.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Filtrar por unidade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as unidades</SelectItem>
            <SelectItem value={SEM_VALOR}>Sem unidade</SelectItem>
            {unidades.map((unidade) => (
              <SelectItem key={unidade.id} value={String(unidade.id)}>
                {unidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {contagemFiltros > 0 && (
          <button
            type="button"
            onClick={() => {
              setFiltroPerfil("todos");
              setFiltroUnidade("todas");
            }}
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
    <div hidden={hidden} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="pb-2">
        <h2 className="text-base font-semibold text-foreground">Acessos</h2>
        <p className="text-sm text-muted-foreground">
          Último dia em que cada pessoa usou o Atlas. Em destaque, quem nunca entrou ou está há{" "}
          {DIAS_SEM_ENTRAR_EM_DESTAQUE} dias ou mais sem entrar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-3">
        <Select value={String(dias)} onValueChange={(valor) => setDias(Number(valor))}>
          <SelectTrigger size="sm" className="h-8 w-auto" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS_DE_ACESSO.map((periodo) => (
              <SelectItem key={periodo.dias} value={String(periodo.dias)}>
                {periodo.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {usuarios.length > 0 &&
          (ehMobile ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative size-8 shrink-0">
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
        {filtrados.length > 0 && (
          <p className="ml-auto text-xs text-muted-foreground">
            {filtrados.length} {filtrados.length === 1 ? "pessoa" : "pessoas"} ·{" "}
            <span className={cn(emDestaqueNaLista > 0 && "font-semibold text-amber-700")}>
              {emDestaqueNaLista} em destaque
            </span>
          </p>
        )}
      </div>

      {/* Erro com dados já na tela (nova busca do mesmo período, ou troca de
          período): a tabela anterior continua, com o aviso acima dela. */}
      {error && acessos && (
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <p className="text-sm text-destructive">
            Não foi possível carregar o período escolhido. A tabela mostra de{" "}
            {formatarDataCurta(acessos.periodo.inicio)} a {formatarDataCurta(acessos.periodo.fim)}.
          </p>
          <Button variant="outline" size="sm" onClick={recarregar}>
            Tentar de novo
          </Button>
        </div>
      )}

      {carregandoPrimeiraVez ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !acessos ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">Não foi possível carregar os acessos.</p>
          <Button variant="outline" size="sm" onClick={recarregar}>
            Tentar de novo
          </Button>
        </div>
      ) : usuarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pessoa da sua rede ainda.</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada com esses filtros.</p>
      ) : (
        // Mesmo contêiner das tabelas da Administração: rola nos dois eixos,
        // com o cabeçalho e a coluna Pessoa fixos.
        <div
          aria-busy={trocandoPeriodo || undefined}
          className={cn(
            "scrollbar-discreta scroll-fade-x min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border transition-opacity",
            trocandoPeriodo && "opacity-60",
          )}
        >
          <table aria-label="Acessos" className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10">
              {/* O que importa para cobrar quem não entra vem logo depois da
                  pessoa, para caber na tela do celular sem rolar de lado. */}
              <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                {COLUNAS.map((coluna) => (
                  <CabecalhoOrdenavel
                    key={coluna.campo}
                    campo={coluna.campo}
                    rotulo={coluna.rotulo}
                    ordenacao={ordenacao}
                    onOrdenar={(campo) => setOrdenacao((atual) => proximaOrdenacao(atual, campo))}
                    className={cn("px-4 py-2.5", coluna.className)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((usuario) => {
                const destaque = emDestaque(usuario);
                return (
                  <tr
                    key={usuario.id}
                    data-destaque={destaque || undefined}
                    className="border-b border-border last:border-0"
                  >
                    {/* Largura limitada no celular: com o e-mail inteiro, a
                        coluna fixa tomava a tela toda. */}
                    <td className="sticky left-0 z-[1] max-w-52 bg-background px-4 py-2.5 sm:max-w-none">
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarUsuario
                          imagem={fotoPorId.get(usuario.id)}
                          iniciais={iniciaisDe(usuario.nome)}
                          className="bg-secondary text-secondary-foreground"
                        />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetalhe(usuario)}
                            aria-label={`Ver os dias de uso de ${usuario.nome}`}
                            className="text-left font-medium text-foreground hover:text-secondary hover:underline"
                          >
                            {usuario.nome}
                          </button>
                          <div className="truncate text-xs text-muted-foreground" title={usuario.email}>
                            {usuario.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={cn(
                          "tabular-nums",
                          destaque && "rounded-full bg-amber-600 px-2 py-px text-xs font-bold text-white",
                        )}
                      >
                        {rotuloDosDiasSemEntrar(usuario)}
                      </span>
                      {/* O selo é só cor: o leitor de tela ouve o destaque. */}
                      {destaque && <span className="sr-only">, em destaque</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      {rotuloDoUltimoUso(usuario)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {usuario.dias_com_uso} de {totalDeDias}
                    </td>
                    <td className="px-4 py-2.5">{usuario.perfil?.nome ?? "Sem perfil"}</td>
                    <td className="px-4 py-2.5">{lotacao(usuario) ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {acessos && (
        <DiasDeUsoDialog
          usuario={detalhe}
          inicio={acessos.periodo.inicio}
          fim={acessos.periodo.fim}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}

function DiasDeUsoDialog({
  usuario,
  inicio,
  fim,
  onFechar,
}: {
  usuario: UsuarioAcesso | null;
  inicio: string;
  fim: string;
  onFechar: () => void;
}) {
  const usados = new Set(usuario?.dias ?? []);
  const meses = mesesDoPeriodo(inicio, fim);
  const descricao = usuario
    ? [usuario.perfil?.nome, lotacao(usuario)].filter(Boolean).join(" · ")
    : "";

  return (
    <Dialog open={usuario !== null} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{usuario?.nome}</DialogTitle>
          <DialogDescription>{descricao || usuario?.email}</DialogDescription>
        </DialogHeader>
        {usuario && (
          <>
            <p className="text-sm text-foreground">
              <span className="font-semibold">
                {usuario.dias_com_uso} {usuario.dias_com_uso === 1 ? "dia" : "dias"} com uso
              </span>{" "}
              de {formatarDataCurta(inicio)} a {formatarDataCurta(fim)}. Último uso:{" "}
              {rotuloDoUltimoUso(usuario).toLowerCase()}.
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {meses.map((mes) => (
                <section key={mes.chave} aria-label={mes.rotulo}>
                  <h3 className="pb-1.5 text-xs font-semibold text-muted-foreground first-letter:uppercase">
                    {mes.rotulo}
                  </h3>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                    {DIAS_DA_SEMANA.map((letra, indice) => (
                      <span key={indice} aria-hidden className="text-muted-foreground">
                        {letra}
                      </span>
                    ))}
                    {Array.from({ length: mes.vazias }, (_, indice) => (
                      <span key={`vazia-${indice}`} aria-hidden />
                    ))}
                    {mes.dias.map((dia) => {
                      const usou = usados.has(dia.iso);
                      return (
                        <span
                          key={dia.iso}
                          data-usou={usou || undefined}
                          title={dia.noPeriodo ? (usou ? "Usou o Atlas" : "Sem uso") : "Fora do período"}
                          className={cn(
                            "flex h-7 items-center justify-center rounded-md tabular-nums",
                            !dia.noPeriodo && "text-muted-foreground/40",
                            dia.noPeriodo && !usou && "bg-muted text-muted-foreground",
                            usou && "bg-secondary font-semibold text-white",
                          )}
                        >
                          {dia.numero}
                          <span className="sr-only">
                            {!dia.noPeriodo ? ", fora do período" : usou ? ", usou o Atlas" : ", sem uso"}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
