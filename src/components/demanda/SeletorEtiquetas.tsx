"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCriarEtiqueta, useEtiquetas } from "@/hooks/useEtiquetas";
import { extrairMensagemErro } from "@/lib/erros";
import { cn } from "@/lib/utils";

const COR_PADRAO = "#007891";

// STC-197: compartilhado entre FormNovaDemanda e EditarDemandaSection --
// mesmo padrão de reuso já usado pra useSetores/useCategorias nos dois.
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
  const { isAdminOps } = useAuth();
  const { criar, isLoading } = useCriarEtiqueta();
  const [criandoNova, setCriandoNova] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(COR_PADRAO);

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
      {etiquetas.map((etiqueta) => (
        <button
          key={etiqueta.id}
          type="button"
          onClick={() => alternar(etiqueta.id)}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium text-white transition-opacity",
            !value.includes(etiqueta.id) && "opacity-40 hover:opacity-70",
          )}
          style={{ backgroundColor: etiqueta.cor }}
        >
          {etiqueta.nome}
        </button>
      ))}

      {/* Não-admin não vê a opção de criar -- mesmo padrão de esconder ação
          sem permissão já usado em AnexoList.tsx/ResponsavelSection.tsx, e
          mesma restrição real do backend (EtiquetaViewSet). */}
      {isAdminOps &&
        (criandoNova ? (
          <div className="flex items-center gap-1">
            <Input
              value={novoNome}
              onChange={(evento) => setNovoNome(evento.target.value)}
              placeholder="Nome"
              maxLength={50}
              className="h-7 w-24 text-[11px]"
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
              disabled={!novoNome.trim() || isLoading}
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
            className="flex items-center gap-0.5 rounded border border-dashed border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-secondary hover:text-secondary"
          >
            <Plus className="size-3" />
            Nova etiqueta
          </button>
        ))}
    </div>
  );
}
