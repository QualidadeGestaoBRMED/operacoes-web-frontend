"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CabecalhoOrdenavel } from "@/components/CabecalhoOrdenavel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useAuth } from "@/hooks/useAuth";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  useAtualizarTipoDocumento,
  useTiposDocumento,
} from "@/hooks/useTiposDocumento";
import { extrairMensagemErro } from "@/lib/erros";
import {
  LABEL_CATEGORIA,
  ORDEM_CATEGORIA,
  rotuloDaAreaResponsavel,
} from "@/lib/legalizacaoMatriz";
import { ordenarPor, proximaOrdenacao, type Ordenacao } from "@/lib/ordenacao";
import {
  podeEditarTipoDeDocumento,
  redesDaAbrangencia,
  ROTULO_ABRANGENCIA,
} from "@/lib/redes";
import { cn } from "@/lib/utils";
import type { TipoDocumentoRegulatorio } from "@/types/legalizacao";
import { FormNovoTipoDocumento } from "./FormNovoTipoDocumento";
import { HistoricoTipoDocumentoModal } from "./HistoricoTipoDocumentoModal";

function areaDoTipo(tipo: TipoDocumentoRegulatorio) {
  return rotuloDaAreaResponsavel(tipo.area_responsavel, redesDaAbrangencia(tipo.abrangencia));
}

// "todos"/"ativos"/"inativos" -- só client-side, mesmo padrão de filtro
// simples já usado em GerenciarUsuarios.tsx (useTiposDocumento não pagina).
const FILTROS_ATIVO = ["todos", "ativos", "inativos"] as const;
type FiltroAtivo = (typeof FILTROS_ATIVO)[number];

type CampoTipos = "nome" | "categoria" | "area" | "status";

// Na ordem das categorias da Matriz, não alfabética; ativos antes dos inativos.
const CHAVES_DE_ORDENACAO = {
  nome: (tipo: TipoDocumentoRegulatorio) => tipo.nome,
  categoria: (tipo: TipoDocumentoRegulatorio) => ORDEM_CATEGORIA.indexOf(tipo.categoria),
  area: areaDoTipo,
  status: (tipo: TipoDocumentoRegulatorio) => (tipo.ativo ? 0 : 1),
};

const ROTULO_FILTRO_ATIVO: Record<FiltroAtivo, string> = {
  todos: "Todos",
  ativos: "Ativos",
  inativos: "Inativos",
};

export function TabelaTiposDocumento() {
  // O catálogo da rede escolhida: os tipos dela e os das duas (STC-904).
  const { rede } = useRedeDaLegalizacao();
  const { tiposDocumento, isLoading, error, mensagemErro } =
    useTiposDocumento(rede);
  const { atualizar } = useAtualizarTipoDocumento();
  // Tipos de documento (STC-904, pode_editar_tipo_de_documento no
  // backend): o Setor de Legalização cria e edita todos; o Admin, os das
  // redes que administra. Coordenação e Ponto focal só consultam.
  const { redesAdministradas, isSetorLeg } = useAuth();
  const quemEdita = {
    redesAdministradas: redesAdministradas ?? [],
    isSetorLeg: Boolean(isSetorLeg),
  };
  const podeCriarTipos = quemEdita.isSetorLeg || quemEdita.redesAdministradas.length > 0;
  // Mesmo hook de GerenciarUsuarios.tsx -- trava a altura da tabela num
  // múltiplo exato de linhas inteiras, usando o espaço real que sobra na
  // tela (refPai é o wrapper com flex-1/min-h que CatalogoLegalizacaoAdmin
  // dá a este componente), em vez de um max-h fixo sem relação com a altura
  // disponível de verdade -- achado no dogfooding: um max-h fixo aninhado
  // dentro do próprio scroll da aba criava 2 scrolls brigando entre si
  // (barra "flutuando" e, no mobile, o gesto de rolar ficava preso dentro
  // da tabela em vez de continuar pra "Cadastrar documento"/"Corrigir
  // regra" logo abaixo).
  const { refPai, refTabela, maxHeight } = useAlturaSemLinhaCortada();
  // Achado no dogfooding mobile: encaixar a tabela numa altura medida junto
  // com "Cadastrar documento"/"Corrigir regra" não sobra espaço numa tela
  // curta -- no mobile a tabela mostra tudo (sem altura travada) e quem rola
  // é a aba inteira (ver CatalogoLegalizacaoAdmin.tsx); só no desktop a
  // tabela tem sua própria caixa com altura medida.
  const ehMobile = useMediaQuery("(max-width: 639px)");
  const [formAberto, setFormAberto] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("todos");
  // Sem coluna escolhida, vale a ordem da API.
  const [ordenacao, setOrdenacao] = useState<Ordenacao<CampoTipos> | null>(null);
  // STC-501: mesmo diálogo de cadastro (FormNovoTipoDocumento) reaproveitado
  // em modo edição quando tipoEditando não é null.
  const [tipoEditando, setTipoEditando] =
    useState<TipoDocumentoRegulatorio | null>(null);
  const [tipoHistoricoId, setTipoHistoricoId] = useState<number | null>(null);

  const tiposFiltrados = tiposDocumento.filter((tipo) => {
    if (filtroCategoria !== "todas" && tipo.categoria !== filtroCategoria)
      return false;
    if (filtroAtivo === "ativos" && !tipo.ativo) return false;
    if (filtroAtivo === "inativos" && tipo.ativo) return false;
    return true;
  });

  function ordenarPelaColuna(campo: CampoTipos) {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  }

  async function alternarAtivo(tipo: TipoDocumentoRegulatorio) {
    try {
      await atualizar({ id: tipo.id, payload: { ativo: !tipo.ativo } });
      toast.success(
        tipo.ativo
          ? "Tipo de documento desativado."
          : "Tipo de documento ativado.",
      );
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <div ref={refPai} className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="pb-2">
        <h2 className="text-base font-semibold text-foreground">
          Tipos de documento
        </h2>
        <p className="text-sm text-muted-foreground">
          Os tipos de documento desta rede e os usados nas duas, marcados
          como &quot;As duas redes&quot;. A categoria e as exigências de um tipo
          são as mesmas em qualquer unidade.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-3">
        {tiposDocumento.length > 0 && (
          <>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger
                size="sm"
                className="h-8 w-full sm:w-auto"
                aria-label="Categoria"
              >
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {ORDEM_CATEGORIA.map((categoria) => (
                  <SelectItem key={categoria} value={categoria}>
                    {LABEL_CATEGORIA[categoria]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filtroAtivo}
              onValueChange={(valor) => setFiltroAtivo(valor as FiltroAtivo)}
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-full sm:w-auto"
                aria-label="Status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {FILTROS_ATIVO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ROTULO_FILTRO_ATIVO[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {podeCriarTipos && (
          <Button
            className="ml-auto shrink-0"
            onClick={() => setFormAberto(true)}
          >
            <Plus className="size-4" />
            Novo tipo de documento
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os tipos de documento: {mensagemErro}
        </p>
      ) : tiposDocumento.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum tipo de documento cadastrado ainda.
        </p>
      ) : tiposFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum tipo de documento encontrado com esses filtros.
        </p>
      ) : (
        <div
          ref={refTabela}
          style={ehMobile ? undefined : { maxHeight }}
          className={cn(
            "scrollbar-discreta scroll-fade-x min-h-0 min-w-0 flex-1 overflow-x-auto rounded-lg border border-border",
            !ehMobile && "overflow-y-auto",
          )}
        >
          <table
            aria-label="Tipos de documento"
            className="w-full min-w-[720px] text-left text-sm"
          >
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {/* sticky left-0: achado testando no mobile (STC-505) -- 6
                    colunas deixavam a tabela larga demais pra tela estreita,
                    e rolar pro lado escondia o Nome junto com o resto, sem
                    contexto de qual linha é qual. Mesmo tratamento aplicado
                    em GerenciarUsuarios.tsx -- ver comentário lá pro
                    racional completo do bg/z-index. */}
                <CabecalhoOrdenavel
                  campo="nome"
                  rotulo="Nome"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPelaColuna}
                  className="sticky left-0 z-20 bg-muted px-4 py-2.5"
                />
                <CabecalhoOrdenavel
                  campo="categoria"
                  rotulo="Categoria"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPelaColuna}
                  className="px-4 py-2.5"
                />
                <CabecalhoOrdenavel
                  campo="area"
                  rotulo="Área responsável"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPelaColuna}
                  className="px-4 py-2.5"
                />
                <th className="px-4 py-2.5">Exigências</th>
                <CabecalhoOrdenavel
                  campo="status"
                  rotulo="Status"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPelaColuna}
                  className="px-4 py-2.5"
                />
                <th className="px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenarPor(tiposFiltrados, ordenacao, CHAVES_DE_ORDENACAO).map((tipo) => (
                <tr
                  key={tipo.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="sticky left-0 z-[1] bg-background px-4 py-2.5 font-medium text-foreground">
                    {tipo.nome}
                    {/* A tabela já é da rede escolhida; só o tipo das duas
                        redes ganha a marca (STC-904). */}
                    {tipo.abrangencia === "ambas" && (
                      <Badge variant="outline" className="ml-2 font-normal">
                        {ROTULO_ABRANGENCIA.ambas}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {LABEL_CATEGORIA[tipo.categoria]}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {areaDoTipo(tipo)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {tipo.exige_validade && (
                        <Badge variant="outline">Validade</Badge>
                      )}
                      {tipo.exige_protocolo && (
                        <Badge variant="outline">Protocolo</Badge>
                      )}
                      {tipo.exige_evidencia && (
                        <Badge variant="outline">Evidência</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {/* Badge mostra o estado, botão descreve a ação -- achado
                        no dogfooding: um botão rotulado com o próprio estado
                        atual ("Ativo") lia como rótulo, não como ação; quem
                        clicava esperava que continuasse ativo, não o
                        oposto. Mesmo padrão de Badge (estado) + botão de ação
                        (Revogar/Reativar) já usado em PermissoesAdmin.tsx. */}
                    <div className="flex w-full items-center justify-between gap-2">
                      <Badge variant={tipo.ativo ? "success" : "muted"}>
                        {tipo.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {podeEditarTipoDeDocumento(quemEdita, tipo.abrangencia) && (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`${tipo.ativo ? "Desativar" : "Ativar"} ${tipo.nome}`}
                          onClick={() => void alternarAtivo(tipo)}
                        >
                          {tipo.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      {podeEditarTipoDeDocumento(quemEdita, tipo.abrangencia) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Editar ${tipo.nome}`}
                          onClick={() => setTipoEditando(tipo)}
                        >
                          Editar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Ver histórico de ${tipo.nome}`}
                        onClick={() => setTipoHistoricoId(tipo.id)}
                      >
                        Histórico
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormNovoTipoDocumento open={formAberto} onOpenChange={setFormAberto} />
      <FormNovoTipoDocumento
        open={tipoEditando !== null}
        onOpenChange={(open) => !open && setTipoEditando(null)}
        tipoDocumento={tipoEditando}
      />
      <HistoricoTipoDocumentoModal
        tipoDocumentoId={tipoHistoricoId}
        nome={
          tiposDocumento.find((tipo) => tipo.id === tipoHistoricoId)?.nome ?? ""
        }
        abrangencia={
          tiposDocumento.find((tipo) => tipo.id === tipoHistoricoId)?.abrangencia ?? "ambas"
        }
        onOpenChange={(open) => !open && setTipoHistoricoId(null)}
      />
    </div>
  );
}
