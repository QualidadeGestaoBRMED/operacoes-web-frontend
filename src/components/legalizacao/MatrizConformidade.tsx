"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import {
  documentoBateNaBusca,
  documentoBateNaCategoria,
  numeroDaUrl,
  ordenarDocumentos,
  ORDEM_CATEGORIA,
  type CampoOrdenavel,
  type Ordenacao,
} from "@/lib/legalizacaoMatriz";
import type {
  CategoriaDocumento,
  DocumentoUnidade,
  DocumentoUnidadeFiltros,
} from "@/types/legalizacao";
import { DetalheDocumentoModal } from "./DetalheDocumentoModal";
import { MatrizFiltros } from "./MatrizFiltros";
import { MatrizTable } from "./MatrizTable";
import { ToggleMapaLista } from "./ToggleMapaLista";

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
  // partir da própria Lista. Única exceção: "Limpar filtros" (ver
  // onLimparUrl abaixo) -- achado no code review, o próprio rótulo do
  // botão promete limpar TUDO, incluindo a querystring que originou o
  // filtro; sem isso, um F5 (ou compartilhar o link) logo depois de
  // "limpar" trazia unidade/categoria de volta sozinhos.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: carregandoSessao, isCoordenacaoUnidade } = useAuth();
  const [filtros, setFiltros] = useState<DocumentoUnidadeFiltros>(() => ({
    unidade: numeroDaUrl(searchParams.get("unidade")),
  }));
  const [categoria, setCategoria] = useState<CategoriaDocumento | undefined>(
    () => categoriaDaUrl(searchParams.get("categoria")),
  );
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  // Deep link (STC-380): estado inicial lido só na montagem (mesmo
  // princípio de unidade/categoria acima) -- é o alvo do clique no card
  // espelho do Kanban de Gestão de Demandas (Plano de Ação §4), que sempre
  // cruza de rota, garantindo montagem nova.
  const [documentoAbertoId, setDocumentoAbertoId] = useState<number | null>(
    () => numeroDaUrl(searchParams.get("documento")) ?? null,
  );

  // Achado em code review (STC-443): o modal de alerta persistente
  // (AlertaPersistenteModal.tsx, montado uma vez em AppShell.tsx, fora de
  // qualquer rota) pode disparar esse mesmo link com o usuário já NESTA
  // tela -- router.push só troca a querystring da rota atual, não remonta
  // o componente, então o useState acima (que só lê na montagem) nunca
  // pegava o id novo. Resincroniza sempre que o parâmetro da URL diverge do
  // estado local -- idempotente pro fluxo interno normal (abrirDetalhe/
  // fecharDetalhe, abaixo, já escrevem os dois juntos), só tem efeito
  // quando a URL muda por fora deste componente.
  const documentoIdNaUrl = numeroDaUrl(searchParams.get("documento")) ?? null;
  useEffect(() => {
    setDocumentoAbertoId(documentoIdNaUrl);
  }, [documentoIdNaUrl]);

  // Achado no code review: numeroDaUrl só valida que o valor é numérico, não
  // que corresponde a uma unidade real -- diferente de categoriaDaUrl (união
  // fixa, valida na hora), não dá pra validar unidade já no useState
  // inicial porque a lista real só chega depois, via useUnidades()
  // (assíncrono). Um id de unidade removida/desativada, vindo de um link
  // salvo/compartilhado antigo (clique numa célula do Mapa gera esse link),
  // ficava preso no filtro sem nenhum SelectItem correspondente -- o
  // <Select> mostrava o placeholder como se nada estivesse selecionado,
  // enquanto o filtro seguia ativo e esvaziava a tabela.
  //
  // erroUnidades checado no if abaixo -- achado no code review: isLoading
  // do SWR vira false assim que a requisição termina, mesmo em falha, então
  // uma falha transitória em /unidades/ (não a unidade não existir de
  // verdade) fazia o efeito rodar com unidades=[] e apagar o filtro por
  // engano. Sem erro, segue validando normalmente; com erro, não mexe no
  // filtro (o erro já derruba a tela mais abaixo, via `error` combinado).
  const {
    unidades,
    isLoading: carregandoUnidades,
    error: erroUnidades,
  } = useUnidades("padrao");
  useEffect(() => {
    if (carregandoUnidades || erroUnidades || !filtros.unidade) return;
    const existe = unidades.some((unidade) => unidade.id === filtros.unidade);
    if (!existe) setFiltros((atual) => ({ ...atual, unidade: undefined }));
  }, [carregandoUnidades, erroUnidades, unidades, filtros.unidade]);

  // STC-512 (review): Coordenador não pode nem ver a opção de sair da
  // própria unidade -- força de volta sempre que divergir (URL editada à
  // mão, ou o próprio valor inicial lido dela). Só passa a valer depois que
  // a sessão resolve (isCoordenacaoUnidade nasce false enquanto carrega,
  // useAuth.ts) -- daí o guard duplo mais abaixo em aguardandoValidacaoDeUnidade,
  // que pausa a busca de documentos até aqui decidir.
  useEffect(() => {
    const unidadeDoUsuario = user?.unidade_id;
    if (!isCoordenacaoUnidade || !unidadeDoUsuario) return;
    if (filtros.unidade === unidadeDoUsuario) return;
    setFiltros((atual) => ({ ...atual, unidade: unidadeDoUsuario }));
  }, [isCoordenacaoUnidade, user?.unidade_id, filtros.unidade]);

  // Achado no code review: sem pausar, a 1ª busca de /documentos/ já saía
  // com o `unidade` ainda não validado (useEffect acima só roda DEPOIS do
  // 1º render, e só corrige depois que unidades carrega) -- se a resposta
  // de /documentos/ chegasse antes da de /unidades/, a tabela mostrava
  // "Nenhum documento encontrado" de verdade por um instante, com o filtro
  // ruim ainda ativo, até o efeito corrigir e disparar a busca certa. Pausa
  // só enquanto HÁ um filtro de unidade E ele ainda não foi validado --
  // sem `unidade` nenhum, não tem o que esperar.
  //
  // carregandoSessao entra aqui também (STC-512, review): isCoordenacaoUnidade
  // nasce false enquanto a sessão carrega (useAuth.ts), então sem isso a
  // 1ª busca podia sair sem filtro de unidade nenhum pro Coordenador --
  // mostrando a tabela inteira da rede por um instante, até a sessão
  // resolver e o efeito acima forçar a unidade dele.
  //
  // aguardandoForcarUnidadeDoCoordenador (2ª rodada de review): sessão já
  // carregada não bastava -- "Limpar filtros" (MatrizFiltros.tsx) chama
  // onMudarFiltros({}), zerando filtros.unidade por um render inteiro antes
  // do efeito acima corrigir de volta. Sem pausar também esse caso, a busca
  // disparava sem filtro nenhum nesse intervalo -- mesmo sintoma do guard
  // de carregandoSessao, só que disparado por uma ação do usuário em vez de
  // timing de sessão.
  const aguardandoForcarUnidadeDoCoordenador =
    isCoordenacaoUnidade &&
    user?.unidade_id !== undefined &&
    filtros.unidade !== user.unidade_id;
  const aguardandoValidacaoDeUnidade =
    (Boolean(filtros.unidade) && carregandoUnidades) ||
    carregandoSessao ||
    aguardandoForcarUnidadeDoCoordenador;
  const {
    documentos,
    carregandoPrimeiraVez,
    error: erroDocumentos,
    mensagemErro,
  } = useDocumentosLegalizacao(filtros, {
    desabilitado: aguardandoValidacaoDeUnidade,
  });

  const error = erroDocumentos ?? erroUnidades;
  const mensagemDeErro =
    mensagemErro ?? (erroUnidades ? extrairMensagemErro(erroUnidades) : null);

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

  // Atualiza a URL junto (shareable/refresh-safe) -- mesmo espírito do
  // deep link que originou a abertura, sem depender de estado React só na
  // memória.
  function abrirDetalhe(documento: DocumentoUnidade) {
    setDocumentoAbertoId(documento.id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("documento", String(documento.id));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function fecharDetalhe() {
    setDocumentoAbertoId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("documento");
    router.replace(
      params.toString() ? `${pathname}?${params.toString()}` : pathname,
      { scroll: false },
    );
  }

  return (
    <div ref={refPai} className="flex h-full min-h-0 flex-col">
      <ToggleMapaLista ativo="lista" linkBiblioteca mostrarMapa={!isCoordenacaoUnidade} />
      <MatrizFiltros
        filtros={filtros}
        onMudarFiltros={setFiltros}
        busca={busca}
        onMudarBusca={setBusca}
        categoria={categoria}
        onMudarCategoria={setCategoria}
        onLimparUrl={() => router.replace(pathname, { scroll: false })}
      />

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {mensagemDeErro}
        </div>
      ) : (
        <MatrizTable
          documentos={documentosExibidos}
          carregandoPrimeiraVez={carregandoPrimeiraVez}
          ordenacao={ordenacao}
          onOrdenar={alternarOrdenacao}
          refTabela={refTabela}
          maxHeight={maxHeight}
          onClickLinha={abrirDetalhe}
        />
      )}

      <DetalheDocumentoModal
        documentoId={documentoAbertoId}
        onOpenChange={(open) => !open && fecharDetalhe()}
      />
    </div>
  );
}
