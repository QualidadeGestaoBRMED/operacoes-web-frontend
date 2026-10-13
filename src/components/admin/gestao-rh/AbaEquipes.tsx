"use client";

import { useMemo, useState } from "react";
import { Info, Search } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useEquipesVR } from "@/hooks/useParametrosGestaoRH";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { CATEGORIAS_EQUIPE, errosDeCampo } from "@/lib/gestaoRH";
import type { CategoriaEquipeVR, EquipeVR } from "@/types/gestaoRH";
import { ErroAoCarregar, MensagemErro } from "./mensagens";

const SEM_CATEGORIA = "sem_categoria";

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Aba Equipes dos Parâmetros de Gestão RH (só Admin): a categoria de cada
 * equipe do VR decide se os colaboradores dela entram no indicador de
 * absenteísmo; na categoria Unidade, a equipe leva uma unidade do Atlas.
 * Salva ao escolher, como a tabela de usuários da Administração. Trocar
 * para Unidade só salva depois de escolher a unidade (a API exige as duas).
 * Tirar ou trocar a unidade de uma equipe com colaboradores pede
 * confirmação: muda a unidade de todos eles e leva as demandas abertas para
 * a coordenação nova.
 */

interface Mudanca {
  equipe: EquipeVR;
  categoria: CategoriaEquipeVR;
  unidade: number | null;
}
export function AbaEquipes() {
  const { equipes, isLoading, mensagemErro, recarregar, reclassificar } = useEquipesVR();
  const { unidades } = useUnidades();
  const [busca, setBusca] = useState("");
  // Equipes que o Admin passou para Unidade e ainda esperam a escolha da unidade.
  const [esperandoUnidade, setEsperandoUnidade] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState<number | null>(null);
  const [erros, setErros] = useState<Record<number, string>>({});
  const [aConfirmar, setAConfirmar] = useState<Mudanca | null>(null);

  const unidadesAtivas = useMemo(() => unidades.filter((unidade) => unidade.ativa), [unidades]);
  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (equipes ?? []).filter((equipe) => !termo || normalizar(equipe.nome).includes(termo));
  }, [equipes, busca]);
  // A unidade atual entra na lista mesmo desativada: sem ela, o campo
  // apareceria vazio numa equipe já classificada.
  function opcoesDeUnidade(equipe: EquipeVR) {
    const atual = equipe.unidade;
    if (!atual || unidadesAtivas.some((unidade) => unidade.id === atual.id)) return unidadesAtivas;
    return [...unidadesAtivas, atual];
  }
  const semCategoria = (equipes ?? []).filter((equipe) => equipe.categoria === SEM_CATEGORIA).length;

  function marcarEsperando(id: number, esperando: boolean) {
    setEsperandoUnidade((atual) => {
      const novo = new Set(atual);
      if (esperando) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  async function salvar(equipe: EquipeVR, categoria: CategoriaEquipeVR, unidade: number | null) {
    setSalvando(equipe.id);
    setErros((atual) => {
      const semEsta = { ...atual };
      delete semEsta[equipe.id];
      return semEsta;
    });
    try {
      const atualizada = await reclassificar(equipe.id, { categoria, unidade });
      marcarEsperando(equipe.id, false);
      toast.success(
        atualizada.unidade
          ? `${atualizada.nome}: ${atualizada.categoria_rotulo} · ${atualizada.unidade.nome}.`
          : `${atualizada.nome}: ${atualizada.categoria_rotulo}.`,
      );
    } catch (erro) {
      const porCampo = errosDeCampo(erro);
      const mensagem = Object.values(porCampo).join(" ") || extrairMensagemErro(erro);
      setErros((atual) => ({ ...atual, [equipe.id]: mensagem }));
    } finally {
      setSalvando(null);
    }
  }

  // Mudança que tira ou troca a unidade de quem já está na equipe passa
  // pela confirmação; as outras salvam direto.
  function mudar(mudanca: Mudanca) {
    const { equipe, unidade } = mudanca;
    const mexeEmQuemEstaNaEquipe =
      equipe.unidade !== null && equipe.colaboradores_ativos > 0 && unidade !== equipe.unidade.id;
    if (mexeEmQuemEstaNaEquipe) setAConfirmar(mudanca);
    else void salvar(equipe, mudanca.categoria, unidade);
  }

  function aoMudarCategoria(equipe: EquipeVR, valor: string) {
    const categoria = valor as CategoriaEquipeVR;
    if (categoria === "unidade" && !equipe.unidade) {
      marcarEsperando(equipe.id, true);
      return;
    }
    marcarEsperando(equipe.id, false);
    mudar({ equipe, categoria, unidade: categoria === "unidade" ? (equipe.unidade?.id ?? null) : null });
  }

  function descricaoDaConfirmacao({ equipe, categoria, unidade }: Mudanca) {
    const pessoas =
      equipe.colaboradores_ativos === 1 ? "O colaborador" : `Os ${equipe.colaboradores_ativos} colaboradores`;
    const de = equipe.unidade?.nome;
    const para = unidadesAtivas.find((opcao) => opcao.id === unidade)?.nome;
    if (para) {
      return (
        <>
          {pessoas} de <strong>{equipe.nome}</strong> passam de {de} para <strong>{para}</strong>, e as
          demandas abertas deles vão para a coordenação de {para}.
        </>
      );
    }
    const rotulo = CATEGORIAS_EQUIPE.find((opcao) => opcao.valor === categoria)?.rotulo;
    return (
      <>
        {pessoas} de <strong>{equipe.nome}</strong> deixam a unidade {de} e passam para <strong>{rotulo}</strong>,
        sem unidade do Atlas. As demandas abertas deles ficam onde estão.
      </>
    );
  }

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!equipes) {
    return (
      <ErroAoCarregar
        mensagem={mensagemErro ?? "Equipes do VR não encontradas."}
        aoTentarNovamente={recarregar}
      />
    );
  }

  return (
    <section aria-labelledby="titulo-equipes-vr" className="space-y-5">
      <div>
        <h2 id="titulo-equipes-vr" className="text-base font-semibold text-foreground">
          Equipes do VR
        </h2>
        <p className="text-sm text-muted-foreground">
          A categoria define se os colaboradores da equipe entram no indicador de absenteísmo.
          Equipes da categoria Unidade levam a unidade do Atlas; as de TMO e Campanha não têm
          unidade, e as demandas delas vão para o responsável definido na aba Absenteísmo.
        </p>
      </div>

      {semCategoria > 0 && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary" />
          {semCategoria === 1
            ? "1 equipe sem categoria: os colaboradores dela ficam fora do indicador até ser classificada."
            : `${semCategoria} equipes sem categoria: os colaboradores delas ficam fora do indicador até serem classificadas.`}
        </p>
      )}

      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar equipe"
          aria-label="Buscar equipe"
          className="pl-8"
        />
      </div>

      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {equipes.length === 0
            ? "Nenhuma equipe do VR ainda. Elas aparecem com a primeira importação."
            : "Nenhuma equipe encontrada com essa busca."}
        </p>
      ) : (
        <div className="scrollbar-discreta scroll-fade-x min-w-0 overflow-x-auto rounded-lg border border-border">
          <table aria-label="Equipes do VR" className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="sticky left-0 z-[1] bg-muted px-4 py-2.5">Equipe</th>
                <th className="px-4 py-2.5 text-right">Colaboradores</th>
                <th className="px-4 py-2.5">Categoria</th>
                <th className="px-4 py-2.5">Unidade do Atlas</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((equipe) => {
                const esperando = esperandoUnidade.has(equipe.id);
                const categoria = esperando ? "unidade" : equipe.categoria;
                const comUnidade = categoria === "unidade";
                const ocupada = salvando === equipe.id;
                const erro = erros[equipe.id];
                const idErro = `equipe-${equipe.id}-erro`;
                return (
                  <tr key={equipe.id} className="border-b border-border align-top last:border-0">
                    <td className="sticky left-0 z-[1] bg-background px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{equipe.nome}</span>
                        {equipe.categoria === SEM_CATEGORIA && !esperando && (
                          <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">
                            Sem categoria
                          </Badge>
                        )}
                      </div>
                      <MensagemErro id={idErro} texto={erro} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {equipe.colaboradores_ativos}
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        value={categoria === SEM_CATEGORIA ? undefined : categoria}
                        onValueChange={(valor) => aoMudarCategoria(equipe, valor)}
                        disabled={ocupada}
                      >
                        <SelectTrigger
                          aria-label={`Categoria de ${equipe.nome}`}
                          aria-invalid={!!erro}
                          aria-describedby={erro ? idErro : undefined}
                          className="w-full min-w-[10rem]"
                        >
                          <SelectValue placeholder="Escolha a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS_EQUIPE.map((opcao) => (
                            <SelectItem key={opcao.valor} value={opcao.valor}>
                              {opcao.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5">
                      {comUnidade ? (
                        <Select
                          value={equipe.unidade && !esperando ? String(equipe.unidade.id) : undefined}
                          onValueChange={(valor) => mudar({ equipe, categoria: "unidade", unidade: Number(valor) })}
                          disabled={ocupada}
                        >
                          <SelectTrigger
                            aria-label={`Unidade de ${equipe.nome}`}
                            aria-invalid={esperando || !!erro}
                            className="w-full min-w-[10rem]"
                          >
                            <SelectValue placeholder="Escolha a unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {opcoesDeUnidade(equipe).map((unidade) => (
                              <SelectItem key={unidade.id} value={String(unidade.id)}>
                                {unidade.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">Sem unidade</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={aConfirmar !== null}
        onOpenChange={(aberto) => !aberto && setAConfirmar(null)}
        titulo="Mudar a unidade da equipe?"
        descricao={aConfirmar ? descricaoDaConfirmacao(aConfirmar) : ""}
        textoConfirmar="Confirmar"
        onConfirmar={() => {
          if (aConfirmar) void salvar(aConfirmar.equipe, aConfirmar.categoria, aConfirmar.unidade);
          setAConfirmar(null);
        }}
      />
    </section>
  );
}
