"use client";

import { useMemo } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { unidadesDoUsuario as unidadesDe } from "@/lib/redes";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAlcanceNoModulo, veSoOsProprios } from "@/hooks/useModulosNavegacao";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { useUnidades } from "@/hooks/useUnidades";
import { useUsuarios } from "@/hooks/useUsuarios";
import {
  LABEL_CATEGORIA,
  LABEL_STATUS,
  ORDEM_CATEGORIA,
  ORDEM_STATUS,
} from "@/lib/legalizacaoMatriz";
import { SITUACAO_ATENCAO } from "@/lib/legalizacaoMapa";
import { nomeExibicao } from "@/lib/utils";
import type {
  CategoriaDocumento,
  DocumentoUnidadeFiltros,
  StatusDocumento,
} from "@/types/legalizacao";

interface MatrizFiltrosProps {
  filtros: DocumentoUnidadeFiltros;
  onMudarFiltros: (filtros: DocumentoUnidadeFiltros) => void;
  busca: string;
  onMudarBusca: (busca: string) => void;
  // categoria não faz parte de DocumentoUnidadeFiltros de propósito (STC-379
  // -- ver comentário em types/legalizacao.ts): filtro só-client, não existe
  // no FilterSet real do backend, então fica fora do objeto que é enviado
  // pra API, com seu próprio par de props em vez de entrar em onMudarFiltros.
  categoria: CategoriaDocumento | undefined;
  onMudarCategoria: (categoria: CategoriaDocumento | undefined) => void;
  // STC-714: "Atenção (a vencer ou protocolado)" no seletor de Status. Não é
  // um status do backend (junta Protocolado com prazo próximo), então é
  // filtro só-client, como categoria; quando ativo, `filtros.status` fica
  // vazio.
  emAtencao: boolean;
  onMudarEmAtencao: (emAtencao: boolean) => void;
  // Opcional -- achado no code review: "Limpar filtros" só resetava o
  // estado em memória, nunca a URL (unidade/categoria chegam aqui via
  // querystring, ver comentário em MatrizConformidade.tsx). O rótulo
  // promete limpar os filtros; sem isso, um F5 (ou compartilhar o link
  // logo depois de "limpar") trazia unidade/categoria de volta sozinhos,
  // porque o useState inicial lê a mesma querystring de novo do zero.
  onLimparUrl?: () => void;
}

export function MatrizFiltros({
  filtros,
  onMudarFiltros,
  busca,
  onMudarBusca,
  categoria,
  onMudarCategoria,
  emAtencao,
  onMudarEmAtencao,
  onLimparUrl,
}: MatrizFiltrosProps) {
  const { user, isCoordenacaoUnidade } = useAuth();
  const unidadesDoUsuario = unidadesDe(user);
  const { rede } = useRedeDaLegalizacao();
  const { unidades: todasAsUnidades } = useUnidades(rede);
  // STC-512: mesmo critério de BibliotecaDocumentos.tsx -- Coordenador só
  // pode escolher a própria unidade no filtro. O backend já restringe o
  // dado de qualquer forma (_documentos_visiveis_para), mas o Select
  // oferecia livremente qualquer unidade da rede, sem indicar que a troca
  // nunca traria resultado de outra unidade.
  const soOsProprios = veSoOsProprios(useAlcanceNoModulo("legalizacao"));
  const { usuarios } = useUsuarios();
  // Não existe hoje um hook pra /tipos-documento/ (fora do escopo da
  // STC-377) -- busca SEM filtro nenhum, catálogo completo, mesmo padrão de
  // unidades/usuarios acima. NÃO reaproveitar a lista já filtrada pelos
  // `filtros` ativos (ex. a que alimenta a tabela): opções derivadas dela se
  // auto-estreitam a cada seleção -- ao escolher um tipo de documento, a
  // lista retorna só aquele tipo, e o próprio select fica com 1 opção só,
  // sem como voltar direto pra outro tipo sem antes limpar o filtro.
  //
  // pausado: true -- achado no code review: essa chamada (sem filtro) tem
  // uma chave de cache do SWR diferente da do MatrizConformidade.tsx (que
  // sempre passa um objeto de filtros, nunca undefined), então as duas
  // NÃO deduplicam -- sem pausar, isso dobra as chamadas ao endpoint a
  // cada ciclo de poll de 60s. O catálogo de tipos de documento muda raras
  // vezes (só via Admin, fora desta tela) -- não precisa de dado fresco a
  // cada minuto, só uma busca inicial já resolve.
  // error desestruturado e usado abaixo (Select "Documento") -- achado no
  // code review (PR #32): antes desta busca virar uma chamada própria, uma
  // falha de rede já aparecia no estado de erro que a tela inteira tratava;
  // isolada aqui, ela ficava sem nenhuma UI de erro, e o Select mostrava só
  // "Todos os documentos" -- indistinguível de "não há outros tipos
  // cadastrados".
  const { documentos: catalogoDocumentos, error: erroCatalogoDocumentos } =
    useDocumentosLegalizacao({ rede }, { pausado: true });

  const tiposDocumento = useMemo(() => {
    const porId = new Map<number, string>();
    for (const documento of catalogoDocumentos) {
      porId.set(documento.tipo_documento.id, documento.tipo_documento.nome);
    }
    return Array.from(porId, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    );
  }, [catalogoDocumentos]);

  // STC-976: quem vê só os próprios documentos escolhe entre as unidades
  // deles, não entre todas da rede.
  const unidades = useMemo(() => {
    if (soOsProprios) {
      const porId = new Map<number, (typeof todasAsUnidades)[number]>();
      for (const documento of catalogoDocumentos) porId.set(documento.unidade.id, documento.unidade);
      return Array.from(porId.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }
    return isCoordenacaoUnidade
      ? todasAsUnidades.filter((unidade) => unidadesDoUsuario.includes(unidade.id))
      : todasAsUnidades;
  }, [soOsProprios, catalogoDocumentos, isCoordenacaoUnidade, todasAsUnidades, unidadesDoUsuario]);

  // filtros.unidade não entra na contagem pro Coordenador (achado no
  // review) -- MatrizConformidade.tsx força esse campo pra unidade dele
  // incondicionalmente, nunca fica undefined pra esse perfil, então contar
  // como "filtro ativo" deixava "Limpar filtros" sempre visível mesmo sem
  // nenhuma escolha real, e clicar nele não limpava nada (o próprio efeito
  // de força reescreve o valor de volta no render seguinte).
  // Com mais de uma unidade (STC-862), a escolha entre elas é filtro de verdade.
  const unidadeTravada = isCoordenacaoUnidade && unidadesDoUsuario.length <= 1;
  const contagemFiltrosSelect = [
    unidadeTravada ? undefined : filtros.unidade,
    filtros.tipo_documento,
    filtros.status,
    filtros.responsavel,
    filtros.prazo_ate,
    categoria,
    emAtencao,
  ].filter(Boolean).length;
  const temFiltrosAtivos = contagemFiltrosSelect > 0 || Boolean(busca);

  function limparFiltros() {
    onMudarBusca("");
    onMudarFiltros({});
    onMudarCategoria(undefined);
    onMudarEmAtencao(false);
    onLimparUrl?.();
  }

  function camposDeFiltro() {
    return (
      <>
        <Select
          value={filtros.unidade ? String(filtros.unidade) : "todas"}
          onValueChange={(valor) =>
            onMudarFiltros({
              ...filtros,
              unidade: valor === "todas" ? undefined : Number(valor),
            })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Unidade"
          >
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent position="popper">
            {/* STC-512 (review): "Todas as unidades" continuava oferecida
                mesmo pro Coordenador, deixando ele sair do filtro da
                própria unidade -- o pedido original é "sem opção de
                trocar". MatrizConformidade.tsx força filtros.unidade de
                volta pra unidade dele mesmo se isso acontecer (URL editada
                à mão, por exemplo), mas a opção nem devia aparecer. */}
            {!unidadeTravada && (
              <SelectItem value="todas">
                {isCoordenacaoUnidade ? "Todas as minhas unidades" : "Todas as unidades"}
              </SelectItem>
            )}
            {unidades.map((unidade) => (
              <SelectItem key={unidade.id} value={String(unidade.id)}>
                {unidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={
            // Achado no code review: "todos" SEMPRE casa com o SelectItem
            // de mesmo valor logo abaixo -- o placeholder do Radix
            // (SelectValue) só aparece quando o `value` atual NÃO corresponde
            // a nenhum item registrado, então "Erro ao carregar" nunca era
            // exibido no caso comum (nenhum filtro ainda selecionado, que é
            // justamente quando o erro tende a aparecer, na carga inicial).
            // "__erro__" não bate com nenhum SelectItem de propósito, força
            // o fallback pro placeholder de verdade. Só afeta o valor
            // EXIBIDO -- o Select já fica `disabled` nesse caso, então
            // onValueChange nunca dispara com esse valor.
            erroCatalogoDocumentos
              ? "__erro__"
              : filtros.tipo_documento
                ? String(filtros.tipo_documento)
                : "todos"
          }
          onValueChange={(valor) =>
            onMudarFiltros({
              ...filtros,
              tipo_documento: valor === "todos" ? undefined : Number(valor),
            })
          }
          disabled={Boolean(erroCatalogoDocumentos)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Documento"
            title={
              erroCatalogoDocumentos
                ? "Erro ao carregar os tipos de documento"
                : undefined
            }
          >
            <SelectValue
              placeholder={
                erroCatalogoDocumentos ? "Erro ao carregar" : "Documento"
              }
            />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos os documentos</SelectItem>
            {tiposDocumento.map((tipo) => (
              <SelectItem key={tipo.id} value={String(tipo.id)}>
                {tipo.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoria ?? "todas"}
          onValueChange={(valor) =>
            onMudarCategoria(
              valor === "todas" ? undefined : (valor as CategoriaDocumento),
            )
          }
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Categoria"
          >
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {ORDEM_CATEGORIA.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {LABEL_CATEGORIA[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={emAtencao ? SITUACAO_ATENCAO : (filtros.status ?? "todos")}
          onValueChange={(valor) => {
            const atencao = valor === SITUACAO_ATENCAO;
            onMudarEmAtencao(atencao);
            onMudarFiltros({
              ...filtros,
              status:
                valor === "todos" || atencao
                  ? undefined
                  : (valor as StatusDocumento),
            });
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value={SITUACAO_ATENCAO}>
              Atenção (a vencer ou protocolado)
            </SelectItem>
            {ORDEM_STATUS.map((status) => (
              <SelectItem key={status} value={status}>
                {LABEL_STATUS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* STC-976: quem vê só os próprios documentos é o responsável deles. */}
        {!soOsProprios && (
          <Select
            value={filtros.responsavel ? String(filtros.responsavel) : "todos"}
            onValueChange={(valor) =>
              onMudarFiltros({
                ...filtros,
                responsavel: valor === "todos" ? undefined : Number(valor),
              })
            }
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-full sm:w-auto"
              aria-label="Responsável"
            >
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {usuarios.map((usuario) => (
                <SelectItem key={usuario.id} value={String(usuario.id)}>
                  {nomeExibicao(usuario)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Mesmo chrome visual do SelectTrigger (size="sm") -- borda/altura/
            padding copiados de select.tsx, pra não destoar dos outros
            filtros ao lado. O <input type="date"> nativo perde a própria
            borda/padding (className vence via twMerge) e só ocupa o espaço
            interno do "pill". */}
        <div className="flex h-8 w-full items-center gap-1.5 rounded-md border border-input bg-transparent px-3 shadow-xs sm:w-auto">
          <Label
            htmlFor="prazo-ate"
            className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
          >
            Prazo até
          </Label>
          <Input
            id="prazo-ate"
            type="date"
            value={filtros.prazo_ate ?? ""}
            onChange={(evento) =>
              onMudarFiltros({
                ...filtros,
                prazo_ate: evento.target.value || undefined,
              })
            }
            className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
          />
        </div>

        {temFiltrosAtivos && (
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

  // Mesmo critério de KanbanFiltros.tsx (STC-186): busca + 6 selects,
  // empilhados, viram uma tela inteira de chrome em telas estreitas antes
  // da tabela aparecer -- colapsa os selects num popover, busca continua
  // sempre visível.
  const ehMobile = useMediaQuery("(max-width: 639px)");

  const busca_ = (
    // flex-1 + teto (era max-w-[320px] fixo) -- achado no review visual: um
    // valor fixo ou sobrava espaço vazio à direita da barra (fixo largo
    // demais) ou cortava o placeholder (fixo estreito demais) dependendo de
    // quanto os outros 6 filtros ocupavam. Crescendo pra preencher o que
    // sobrar (com piso/teto pra nunca ficar minúsculo nem enorme) resolve
    // os dois sem precisar advinhar um número mágico por tentativa.
    <div className="relative min-w-[160px] flex-1 sm:max-w-sm">
      <Label htmlFor="busca-matriz" className="sr-only">
        Buscar unidade ou documento
      </Label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="busca-matriz"
        value={busca}
        onChange={(evento) => onMudarBusca(evento.target.value)}
        placeholder="Buscar unidade ou documento..."
        className="h-9 pl-9"
      />
    </div>
  );

  if (ehMobile) {
    return (
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {busca_}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative shrink-0">
              <ListFilter className="size-4" />
              <span className="sr-only">Filtros</span>
              {contagemFiltrosSelect > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]"
                >
                  {contagemFiltrosSelect}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex flex-col gap-2">
            {camposDeFiltro()}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-7 py-4">
      {busca_}
      {camposDeFiltro()}
    </div>
  );
}
