"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { SeletorAreaResponsavel } from "@/components/demanda/SeletorAreaResponsavel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategorias } from "@/hooks/useCategorias";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSetores } from "@/hooks/useSetores";
import { useTiposGestao } from "@/hooks/useTiposGestao";
import { useUnidades } from "@/hooks/useUnidades";
import { useUsuarios } from "@/hooks/useUsuarios";
import { CODIGO_TIPO_GESTAO_OPERACIONAL } from "@/lib/kanban";
import { nomeExibicao } from "@/lib/utils";
import { MENSAGEM_SOMENTE_LEITURA, useVerComo } from "@/lib/verComo";

const ID_DICA_SOMENTE_LEITURA = "dica-nova-demanda-somente-leitura";
import { administra, NIVEL_ADMIN_QG } from "@/lib/redes";
import type { DemandaFiltros, Prioridade } from "@/types";

// Espelha accounts/permissions.py -- mesmos níveis usados em
// ResponsavelSection.tsx (elegibilidade pra virar responsável de uma
// demanda específica). Aqui a regra é por tipo de gestão, não por unidade:
// o filtro é do board inteiro, não de uma demanda com unidade já definida.

const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: "urgente", rotulo: "Urgente" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "media", rotulo: "Média" },
  { valor: "baixa", rotulo: "Baixa" },
];

interface KanbanFiltrosProps {
  filtros: DemandaFiltros;
  onMudarFiltros: (filtros: DemandaFiltros) => void;
  onNovaDemanda: () => void;
}

export function KanbanFiltros({ filtros, onMudarFiltros, onNovaDemanda }: KanbanFiltrosProps) {
  // "Ver como" (STC-790): só leitura, sem criar demanda.
  const verComo = useVerComo();
  // A dica também para o leitor de tela (o title não é lido de forma
  // confiável num botão desabilitado).
  const dicaSomenteLeitura = verComo ? (
    <span id={ID_DICA_SOMENTE_LEITURA} className="sr-only">
      {MENSAGEM_SOMENTE_LEITURA}
    </span>
  ) : null;
  const { categorias } = useCategorias();
  const { tiposGestao } = useTiposGestao();
  const { usuarios } = useUsuarios();
  // Setor não é module-scoped por URL (diferente de tipos-gestao/categorias)
  // -- mesmo critério do FormNovaDemanda: reaproveita o modulo já carregado
  // via TipoGestao em vez de assumir/hardcodar um id.
  // Achado no review: usar tiposGestao[0] direto funcionava só por
  // coincidência (hoje todo TipoGestao desse módulo compartilha o mesmo
  // modulo) -- deriva do tipo_gestao realmente ativo, com o primeiro item
  // como fallback só pro instante antes da aba padrão ser aplicada na URL.
  const tipoGestaoAtivo = tiposGestao.find((tipo) => tipo.id === filtros.tipo_gestao);
  const moduloAtivo = tipoGestaoAtivo?.modulo ?? tiposGestao[0]?.modulo;
  // STC-510 (achado testando ao vivo): o filtro de Unidade tem que
  // acompanhar a rede da aba de Tipo Gestão ativa -- sem isso, a aba
  // "OPEX" mostrava as filiais normais no filtro (rede errada, fixa em
  // "padrao" incondicional), mesmo elas nunca aparecendo de verdade nas
  // demandas daquela aba.
  const { unidades } = useUnidades(tipoGestaoAtivo?.visibilidade_padrao === "opex" ? "opex" : "padrao");
  const ehOperacional = tipoGestaoAtivo?.codigo === CODIGO_TIPO_GESTAO_OPERACIONAL;
  const { setores } = useSetores(moduloAtivo);
  // Admin Q&G nunca é responsável de demanda nenhuma (mesma regra de
  // ResponsavelSection.tsx) -- fora isso, Operacional só aceita quem
  // administra a rede padrão (Admin Operações ou Gestão de Operações; sem
  // unidade pra restringir por local, ver validate_usuario_id no backend),
  // Unidades aceita qualquer outro nível.
  const candidatosResponsavel = usuarios.filter((usuario) => {
    if (usuario.perfil?.nivel === NIVEL_ADMIN_QG) return false;
    if (ehOperacional) return administra(usuario, "padrao");
    return true;
  });
  // Busca com debounce local -- não dispara um filtro (e um fetch) a cada
  // tecla, só 300ms depois que o usuário parar de digitar.
  const [buscaLocal, setBuscaLocal] = useState(filtros.search ?? "");

  // Achado no code review: o timer de debounce fechava sobre 'filtros' e
  // 'onMudarFiltros' do momento em que foi agendado -- se o usuário trocasse
  // unidade/prioridade nos 300ms seguintes, o timer disparava depois com o
  // filtro ANTIGO e revertia essa escolha. O ref sempre aponta pro valor
  // mais recente, sem precisar recriar o timer a cada mudança de filtro.
  const filtrosRef = useRef(filtros);
  const onMudarFiltrosRef = useRef(onMudarFiltros);
  useEffect(() => {
    filtrosRef.current = filtros;
    onMudarFiltrosRef.current = onMudarFiltros;
  });

  // Ressincroniza o campo quando 'filtros.search' muda por uma via externa
  // a este componente (ex.: botão Voltar do navegador) -- sem isso, o texto
  // exibido podia ficar diferente do filtro de verdade aplicado ao board.
  // Quando a mudança vem do próprio debounce abaixo, buscaLocal já está
  // igual, então isso não interfere na digitação.
  useEffect(() => {
    setBuscaLocal(filtros.search ?? "");
  }, [filtros.search]);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      if (buscaLocal !== (filtrosRef.current.search ?? "")) {
        onMudarFiltrosRef.current({ ...filtrosRef.current, search: buscaLocal || undefined });
      }
    }, 300);
    return () => clearTimeout(temporizador);
  }, [buscaLocal]);

  // Separado de "busca" de propósito: a busca continua sempre visível (é o
  // controle mais usado, não pesa visualmente); só os selects colapsam no
  // popover mobile, e é só a contagem deles que faz sentido no badge do
  // botão "Filtros" -- contar a busca junto inflaria o número sem
  // corresponder a nada que o popover realmente controla.
  const contagemFiltrosSelect =
    [filtros.unidade, filtros.setor, filtros.responsavel, filtros.prioridade, filtros.categoria].filter(
      Boolean,
    ).length + (filtros.area_responsavel && filtros.area_responsavel.length > 0 ? 1 : 0);
  const temFiltrosAtivos = contagemFiltrosSelect > 0 || Boolean(filtros.search);

  function limparFiltros() {
    // Achado no review: onMudarFiltros({}) zerava tipo_gestao junto -- o
    // efeito de aba padrão em KanbanBoard via a URL sem esse campo e
    // repunha a primeira aba sozinho, mesmo com o usuário na segunda.
    // "Limpar filtros" deve limpar os filtros de fato (unidade/setor/
    // prioridade/categoria/busca), não trocar de aba.
    setBuscaLocal("");
    onMudarFiltros({ tipo_gestao: filtros.tipo_gestao });
  }

  // Extraído pra função (não componente à parte): os 4 selects renderizam
  // ou inline (desktop) ou dentro do Popover (mobile) -- ver useMediaQuery
  // abaixo. Mesma árvore de elementos reaproveitada nos dois branches, só
  // o container ao redor muda; evita duplicar a lógica/estado de cada
  // Select em dois lugares (e o risco de um <label htmlFor> duplicado que
  // isso geraria).
  function camposDeFiltro() {
    return (
      <>
        {/* Demanda do tipo de gestão "Operacional" não tem unidade (usa
            area_responsavel) -- mesmo critério de FormNovaDemanda.tsx. Os
            dois filtros ocupam a mesma posição, nunca aparecem juntos. */}
        {ehOperacional ? (
          <SeletorAreaResponsavel
            aria-label="Área Responsável"
            className="h-8 w-full sm:w-auto"
            placeholder="Todas as áreas responsáveis"
            opcaoTodas="Todas as áreas responsáveis"
            value={filtros.area_responsavel ?? []}
            onChange={(areas) =>
              onMudarFiltros({
                ...filtros,
                area_responsavel: areas.length > 0 ? areas : undefined,
              })
            }
          />
        ) : (
          <Select
            value={filtros.unidade ? String(filtros.unidade) : "todas"}
            onValueChange={(valor) =>
              onMudarFiltros({ ...filtros, unidade: valor === "todas" ? undefined : Number(valor) })
            }
          >
            {/* aria-label (não só o placeholder do SelectValue): sem rótulo
                visível nesse componente, o placeholder é a única pista do que
                o campo representa -- mas ele some do DOM assim que um valor é
                selecionado, e o nome acessível vira só o valor escolhido
                ("Niterói"), sem dizer que campo é. aria-label persiste
                independente de ter valor selecionado ou não. */}
            <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Unidade">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {unidades.map((unidade) => (
                <SelectItem key={unidade.id} value={String(unidade.id)}>
                  {unidade.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filtros.setor ? String(filtros.setor) : "todos"}
          onValueChange={(valor) =>
            onMudarFiltros({ ...filtros, setor: valor === "todos" ? undefined : Number(valor) })
          }
        >
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Setor Origem">
            <SelectValue placeholder="Setor Origem" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos os setores origem</SelectItem>
            {setores.map((setor) => (
              <SelectItem key={setor.id} value={String(setor.id)}>
                {setor.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.responsavel ? String(filtros.responsavel) : "todos"}
          onValueChange={(valor) =>
            onMudarFiltros({
              ...filtros,
              responsavel: valor === "todos" ? undefined : Number(valor),
            })
          }
        >
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Responsável">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {candidatosResponsavel.map((usuario) => (
              <SelectItem key={usuario.id} value={String(usuario.id)}>
                {nomeExibicao(usuario)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.prioridade ?? "todas"}
          onValueChange={(valor) =>
            onMudarFiltros({
              ...filtros,
              prioridade: valor === "todas" ? undefined : (valor as Prioridade),
            })
          }
        >
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Prioridade">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todas">Todas as prioridades</SelectItem>
            {PRIORIDADES.map((prioridade) => (
              <SelectItem key={prioridade.valor} value={prioridade.valor}>
                {prioridade.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sem sentido escolher entre uma única opção -- só aparece quando
            houver categoria de verdade pra filtrar. */}
        {categorias.length > 1 && (
          <Select
            value={filtros.categoria ? String(filtros.categoria) : "todas"}
            onValueChange={(valor) =>
              onMudarFiltros({
                ...filtros,
                categoria: valor === "todas" ? undefined : Number(valor),
              })
            }
          >
            <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Categoria">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map((categoria) => (
                <SelectItem key={categoria.id} value={String(categoria.id)}>
                  {categoria.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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

  // Achado na avaliação de UX mobile (pós-STC-186): busca + 4 selects +
  // limpar + Nova Demanda, tudo empilhado em telas estreitas, virava uma
  // tela inteira de chrome antes do usuário ver qualquer card. useMediaQuery
  // (não CSS puro): os mesmos campos aparecem inline no desktop e dentro de
  // um popover flutuante no mobile -- é reposicionamento estrutural, não só
  // visibilidade, então CSS sozinho exigiria duplicar os <Select>/<label>
  // no DOM (id repetido, problema de acessibilidade). Só uma das duas
  // árvores monta por vez.
  const ehMobile = useMediaQuery("(max-width: 639px)");

  const busca = (
    <div className="relative w-full max-w-[320px]">
      <label htmlFor="busca-demandas" className="sr-only">
        Buscar demanda por título ou descrição
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="busca-demandas"
        value={buscaLocal}
        onChange={(evento) => setBuscaLocal(evento.target.value)}
        placeholder="Buscar demanda..."
        className="h-9 pl-9"
      />
    </div>
  );

  if (ehMobile) {
    return (
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {busca}

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

        <Button
          size="icon"
          className="shrink-0"
          onClick={onNovaDemanda}
          disabled={Boolean(verComo)}
          title={verComo ? MENSAGEM_SOMENTE_LEITURA : undefined}
          aria-describedby={verComo ? ID_DICA_SOMENTE_LEITURA : undefined}
        >
          <span className="sr-only">Nova Demanda</span>
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
        </Button>
        {dicaSomenteLeitura}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-7 py-4">
      {busca}
      {camposDeFiltro()}
      <Button
        className="ml-auto"
        onClick={onNovaDemanda}
        disabled={Boolean(verComo)}
        title={verComo ? MENSAGEM_SOMENTE_LEITURA : undefined}
        aria-describedby={verComo ? ID_DICA_SOMENTE_LEITURA : undefined}
      >
        Nova Demanda
      </Button>
      {dicaSomenteLeitura}
    </div>
  );
}
