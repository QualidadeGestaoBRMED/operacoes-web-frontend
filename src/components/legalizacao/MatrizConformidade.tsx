"use client";

import { useMemo, useState } from "react";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import {
  documentoBateNaBusca,
  ordenarDocumentos,
  type CampoOrdenavel,
  type Ordenacao,
} from "@/lib/legalizacaoMatriz";
import type { DocumentoUnidadeFiltros } from "@/types/legalizacao";
import { MatrizFiltros } from "./MatrizFiltros";
import { MatrizTable } from "./MatrizTable";

export function MatrizConformidade() {
  const [filtros, setFiltros] = useState<DocumentoUnidadeFiltros>({});
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);

  const { documentos, carregandoPrimeiraVez, error, mensagemErro } =
    useDocumentosLegalizacao(filtros);

  // Mesmo hook/padrão da tela de Administração (GerenciarUsuarios.tsx):
  // trava a altura da área rolável num múltiplo exato de linhas inteiras
  // (nunca corta uma linha na metade) e do tamanho disponível da tela, não
  // da quantidade de documentos -- poucas linhas deixam espaço vazio
  // DENTRO da caixa com borda (que continua do mesmo tamanho), em vez da
  // caixa encolher e sobrar espaço solto entre ela e a legenda abaixo.
  const { refPai, refTabela, maxHeight } = useAlturaSemLinhaCortada();

  const documentosExibidos = useMemo(() => {
    const filtrados = documentos.filter((documento) =>
      documentoBateNaBusca(documento, busca),
    );
    return ordenarDocumentos(filtrados, ordenacao);
  }, [documentos, busca, ordenacao]);

  // Clique no cabeçalho: 1º clique ordena crescente, 2º inverte pra
  // decrescente, 3º volta pra ordem padrão (sem ordenação). Clicar numa
  // coluna diferente da ativa sempre começa em crescente.
  function alternarOrdenacao(campo: CampoOrdenavel) {
    setOrdenacao((atual) => {
      if (atual?.campo !== campo) return { campo, direcao: "asc" };
      if (atual.direcao === "asc") return { campo, direcao: "desc" };
      return null;
    });
  }

  return (
    <div ref={refPai} className="flex h-full min-h-0 flex-col">
      <MatrizFiltros
        filtros={filtros}
        onMudarFiltros={setFiltros}
        busca={busca}
        onMudarBusca={setBusca}
        documentos={documentos}
      />

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {mensagemErro}
        </div>
      ) : (
        <MatrizTable
          documentos={documentosExibidos}
          carregandoPrimeiraVez={carregandoPrimeiraVez}
          ordenacao={ordenacao}
          onOrdenar={alternarOrdenacao}
          refTabela={refTabela}
          maxHeight={maxHeight}
        />
      )}
    </div>
  );
}
