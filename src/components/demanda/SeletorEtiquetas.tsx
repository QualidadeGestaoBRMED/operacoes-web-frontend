"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useCriarEtiqueta, useEtiquetas } from "@/hooks/useEtiquetas";
import { extrairMensagemErro } from "@/lib/erros";
import { cn } from "@/lib/utils";

const COR_PADRAO = "#007891";

// STC-197: compartilhado entre FormNovaDemanda e EditarDemandaSection --
// mesmo padrão de reuso já usado pra useSetores/useCategorias nos dois.
//
// Achado no dogfooding: a versão original listava TODAS as etiquetas como
// chips clicáveis direto no formulário -- ótimo com poucas, mas o catálogo
// não tem limite (qualquer admin pode criar uma nova) e o formulário virava
// uma parede de chips. Reaproveita o mesmo padrão de multi-seleção em
// Popover+Checkbox já usado em PermissoesAdmin/FormNovaPermissao (Pessoa/
// Ação) -- com um campo de busca a mais, já que aqui o catálogo cresce sem
// nenhum teto natural (Ação, por exemplo, tem só 7 valores fixos).
export function SeletorEtiquetas({
  value,
  onChange,
  modulo,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  modulo?: number;
}) {
  const { etiquetas } = useEtiquetas(modulo);
  // Etiquetas não têm rede: são da rede padrão (STC-762).
  const { administraRedePadrao } = useAuth();
  const { criar, isLoading } = useCriarEtiqueta();
  const [busca, setBusca] = useState("");
  const [criandoNova, setCriandoNova] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(COR_PADRAO);

  const selecionadas = etiquetas.filter((etiqueta) => value.includes(etiqueta.id));
  const etiquetasFiltradas = etiquetas.filter((etiqueta) =>
    etiqueta.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  function alternar(id: number) {
    onChange(value.includes(id) ? value.filter((existente) => existente !== id) : [...value, id]);
  }

  async function aoCriar() {
    if (!novoNome.trim() || !modulo) return;
    try {
      const nova = await criar({ modulo, nome: novoNome.trim(), cor: novaCor });
      onChange([...value, nova.id]);
      setNovoNome("");
      setNovaCor(COR_PADRAO);
      setCriandoNova(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Chips das já selecionadas continuam visíveis fora do popover --
          diferente do filtro de Pessoa (que só mostra contagem no botão),
          aqui vale ver de cara quais etiquetas estão marcadas, com um "x"
          direto pra remover sem precisar reabrir o popover pra cada uma. */}
      {selecionadas.map((etiqueta) => (
        <span
          key={etiqueta.id}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: etiqueta.cor }}
        >
          {etiqueta.nome}
          <button
            type="button"
            onClick={() => alternar(etiqueta.id)}
            aria-label={`Remover etiqueta ${etiqueta.nome}`}
            className="opacity-80 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      <Popover
        onOpenChange={(aberto) => {
          if (!aberto) setBusca("");
        }}
      >
        <PopoverTrigger asChild>
          {/* Sem modulo (Tipo de gestão ainda não selecionado em
              FormNovaDemanda), listarEtiquetas() lista de TODOS os módulos
              (sem filtro) e "Criar" não tinha como saber em qual módulo
              criar -- ficava clicável, mas o clique não fazia nada,
              silenciosamente. Desabilitar o próprio gatilho, com o motivo
              no title, fecha esse caminho de vez, em vez de só esconder o
              sintoma dentro do popover. */}
          <button
            type="button"
            disabled={!modulo}
            title={modulo ? undefined : "Selecione o tipo de gestão primeiro."}
            className="flex items-center gap-0.5 rounded border border-dashed border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:text-muted-foreground"
          >
            <Plus className="size-3" />
            Etiqueta
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1.5">
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar etiqueta..."
            className="mb-1.5 h-7 text-xs"
            autoFocus
          />
          <div className="scrollbar-discreta max-h-48 overflow-y-auto">
            {etiquetasFiltradas.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Nenhuma etiqueta encontrada.
              </p>
            ) : (
              etiquetasFiltradas.map((etiqueta) => (
                <label
                  key={etiqueta.id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={value.includes(etiqueta.id)}
                    onCheckedChange={() => alternar(etiqueta.id)}
                    className="shrink-0"
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: etiqueta.cor }}
                  />
                  <span className="truncate">{etiqueta.nome}</span>
                </label>
              ))
            )}
          </div>

          {/* Não-admin não vê a opção de criar -- mesmo padrão de esconder
              ação sem permissão já usado em AnexoList.tsx/ResponsavelSection.tsx,
              e mesma restrição real do backend (EtiquetaViewSet). */}
          {administraRedePadrao &&
            (criandoNova ? (
              <div className="mt-1.5 flex items-center gap-1 border-t border-border pt-1.5">
                <Input
                  value={novoNome}
                  onChange={(evento) => setNovoNome(evento.target.value)}
                  placeholder="Nome"
                  maxLength={50}
                  className="h-7 flex-1 text-[11px]"
                  autoFocus
                />
                <input
                  type="color"
                  value={novaCor}
                  onChange={(evento) => setNovaCor(evento.target.value)}
                  className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input p-0.5"
                  aria-label="Cor da etiqueta"
                />
                <Button
                  type="button"
                  size="xs"
                  onClick={() => void aoCriar()}
                  disabled={!novoNome.trim() || !modulo || isLoading}
                >
                  Criar
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setCriandoNova(false);
                    setNovoNome("");
                    setNovaCor(COR_PADRAO);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCriandoNova(true)}
                className={cn(
                  "mt-1.5 flex w-full items-center gap-1 rounded-sm border-t border-border px-2 pt-2 text-[11px] font-medium text-muted-foreground hover:text-secondary",
                )}
              >
                <Plus className="size-3" />
                Nova etiqueta
              </button>
            ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
