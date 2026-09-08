"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAtualizarTipoDocumento,
  useTiposDocumento,
} from "@/hooks/useTiposDocumento";
import { extrairMensagemErro } from "@/lib/erros";
import { LABEL_CATEGORIA, ORDEM_CATEGORIA } from "@/lib/legalizacaoMatriz";
import type {
  AreaResponsavelDocumento,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { FormNovoTipoDocumento } from "./FormNovoTipoDocumento";

const ROTULO_AREA_RESPONSAVEL: Record<AreaResponsavelDocumento, string> = {
  legalizacao: "Legalização",
  coordenacao: "Coordenação da Unidade",
};

// "todos"/"ativos"/"inativos" -- só client-side, mesmo padrão de filtro
// simples já usado em GerenciarUsuarios.tsx (useTiposDocumento não pagina).
const FILTROS_ATIVO = ["todos", "ativos", "inativos"] as const;
type FiltroAtivo = (typeof FILTROS_ATIVO)[number];

const ROTULO_FILTRO_ATIVO: Record<FiltroAtivo, string> = {
  todos: "Todos",
  ativos: "Ativos",
  inativos: "Inativos",
};

export function TabelaTiposDocumento() {
  const { tiposDocumento, isLoading } = useTiposDocumento();
  const { atualizar } = useAtualizarTipoDocumento();
  const [formAberto, setFormAberto] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("todos");

  const tiposFiltrados = tiposDocumento.filter((tipo) => {
    if (filtroCategoria !== "todas" && tipo.categoria !== filtroCategoria)
      return false;
    if (filtroAtivo === "ativos" && !tipo.ativo) return false;
    if (filtroAtivo === "inativos" && tipo.ativo) return false;
    return true;
  });

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
    <div className="flex min-h-0 flex-col">
      <div className="pb-2">
        <h2 className="text-base font-semibold text-foreground">
          Tipos de documento
        </h2>
        <p className="text-sm text-muted-foreground">
          Catálogo global, reutilizável entre unidades -- categoria e exigências
          não mudam unidade a unidade.
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
        <Button
          className="ml-auto shrink-0"
          onClick={() => setFormAberto(true)}
        >
          <Plus className="size-4" />
          Novo tipo de documento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : tiposDocumento.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum tipo de documento cadastrado ainda.
        </p>
      ) : tiposFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum tipo de documento encontrado com esses filtros.
        </p>
      ) : (
        <div className="scrollbar-discreta scroll-fade-x min-h-0 max-h-96 min-w-0 overflow-auto rounded-lg border border-border">
          <table
            aria-label="Tipos de documento"
            className="w-full min-w-[720px] text-left text-sm"
          >
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">Categoria</th>
                <th className="px-4 py-2.5">Área responsável</th>
                <th className="px-4 py-2.5">Exigências</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {tiposFiltrados.map((tipo) => (
                <tr
                  key={tipo.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {tipo.nome}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {LABEL_CATEGORIA[tipo.categoria]}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {ROTULO_AREA_RESPONSAVEL[tipo.area_responsavel]}
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
                    <div className="flex items-center gap-4">
                      <Badge variant={tipo.ativo ? "success" : "muted"}>
                        {tipo.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`${tipo.ativo ? "Desativar" : "Ativar"} ${tipo.nome}`}
                        onClick={() => void alternarAtivo(tipo)}
                      >
                        {tipo.ativo ? "Desativar" : "Ativar"}
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
    </div>
  );
}
