"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import {
  documentoBateNaBusca,
  documentoBateNaCategoria,
  ordenarDocumentos,
  ORDEM_CATEGORIA,
  type CampoOrdenavel,
  type Ordenacao,
} from "@/lib/legalizacaoMatriz";
import type {
  CategoriaDocumento,
  DocumentoUnidadeFiltros,
} from "@/types/legalizacao";
import { MatrizFiltros } from "./MatrizFiltros";
import { MatrizTable } from "./MatrizTable";
import { ToggleMapaLista } from "./ToggleMapaLista";

function numeroDaUrl(valor: string | null): number | undefined {
  if (!valor) return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

// Achado no code review: o clique numa célula do Mapa sempre manda um valor
// de ORDEM_CATEGORIA (MatrizMapaGrid.tsx), mas a URL pode ser editada à mão
// -- sem validar contra a união real, um valor qualquer (?categoria=xyz)
// virava estado, e o <Select> de Categoria (MatrizFiltros.tsx) recebia um
// value sem SelectItem correspondente.
function categoriaDaUrl(valor: string | null): CategoriaDocumento | undefined {
  return ORDEM_CATEGORIA.find((categoria) => categoria === valor);
}

export function MatrizConformidade() {
  // Lido só na 1ª renderização (useState com inicializador, não um efeito
  // sincronizando toda mudança de URL) -- STC-379: clique numa célula do
  // Mapa chega aqui com ?unidade=X&categoria=Y, e os filtros nascem já
  // aplicados. Diferente do Kanban (STC-206), que sincroniza filtro <->
  // URL nos dois sentidos o tempo todo -- aqui só a entrada importa, não
  // há necessidade (ainda) de compartilhar um link com filtro aplicado a
  // partir da própria Lista.
  const searchParams = useSearchParams();
  const [filtros, setFiltros] = useState<DocumentoUnidadeFiltros>(() => ({
    unidade: numeroDaUrl(searchParams.get("unidade")),
  }));
  const [categoria, setCategoria] = useState<CategoriaDocumento | undefined>(
    () => categoriaDaUrl(searchParams.get("categoria")),
  );
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
    const filtrados = documentos
      .filter((documento) => documentoBateNaBusca(documento, busca))
      .filter((documento) => documentoBateNaCategoria(documento, categoria));
    return ordenarDocumentos(filtrados, ordenacao);
  }, [documentos, busca, categoria, ordenacao]);

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
      <ToggleMapaLista ativo="lista" />
      <MatrizFiltros
        filtros={filtros}
        onMudarFiltros={setFiltros}
        busca={busca}
        onMudarBusca={setBusca}
        categoria={categoria}
        onMudarCategoria={setCategoria}
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
