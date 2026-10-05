"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useReguaFerias } from "@/hooks/useParametrosGestaoRH";
import { extrairMensagemErro } from "@/lib/erros";
import { MARCOS_DA_TELA, errosDeCampo, errosPorItem } from "@/lib/gestaoRH";
import type { MarcoEditado, TipoMarcoEditavel, VersaoMarcoRegua } from "@/types/gestaoRH";

type Edicao = Record<TipoMarcoEditavel, { dias: string; ativo: boolean }>;

function edicaoDosMarcos(marcos: VersaoMarcoRegua[]): Edicao | null {
  const porTipo = new Map(marcos.map((marco) => [marco.tipo_marco, marco]));
  const edicao = {} as Edicao;
  for (const { tipo } of MARCOS_DA_TELA) {
    const marco = porTipo.get(tipo);
    if (!marco) return null;
    edicao[tipo] = { dias: String(marco.dias), ativo: marco.ativo };
  }
  return edicao;
}

export function FormReguaFerias() {
  const { marcos, isLoading, mensagemErro, salvar } = useReguaFerias();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState<string>();
  const [erroPorMarco, setErroPorMarco] = useState<Partial<Record<TipoMarcoEditavel, string>>>({});
  const [editado, setEditado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Recarregar a régua (ex.: outro Admin salvou e a tela revalidou) não
  // substitui uma edição em andamento.
  useEffect(() => {
    if (marcos && !editado) setEdicao(edicaoDosMarcos(marcos));
  }, [marcos, editado]);

  function alterar(tipo: TipoMarcoEditavel, mudanca: Partial<{ dias: string; ativo: boolean }>) {
    setEditado(true);
    setEdicao((atual) => (atual ? { ...atual, [tipo]: { ...atual[tipo], ...mudanca } } : atual));
  }

  function limparErros() {
    setErro(undefined);
    setErroPorMarco({});
  }

  async function aoSalvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!edicao) return;
    limparErros();
    const payload: MarcoEditado[] = MARCOS_DA_TELA.map(({ tipo }) => ({
      tipo_marco: tipo,
      dias: Number(edicao[tipo].dias),
      ativo: edicao[tipo].ativo,
    }));
    setSalvando(true);
    try {
      const resultado = await salvar(payload);
      setEdicao(edicaoDosMarcos(resultado.dados.marcos));
      setEditado(false);
      if (resultado.criouVersao) {
        toast.success("Régua de férias salva.");
      } else {
        toast.info("Nenhuma alteração na régua de férias.");
      }
    } catch (falha) {
      // Erro por marco vem na mesma ordem do que foi enviado (MARCOS_DA_TELA):
      // aparece na linha do marco, não solto embaixo da lista.
      const porItem = errosPorItem(falha, "marcos");
      if (porItem) {
        setErroPorMarco(
          Object.fromEntries(
            MARCOS_DA_TELA.map(({ tipo }, indice) => [tipo, porItem[indice]]).filter(
              ([, mensagem]) => mensagem,
            ),
          ),
        );
        return;
      }
      const mensagem = Object.values(errosDeCampo(falha)).join(" ");
      if (mensagem) setErro(mensagem);
      else toast.error(extrairMensagemErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  // Botões só com alteração de verdade: desfazer uma mudança desabilita de novo.
  const mudou =
    !!marcos &&
    !!edicao &&
    JSON.stringify(edicao) !== JSON.stringify(edicaoDosMarcos(marcos));

  if (isLoading) return <Skeleton className="h-56 w-full" />;
  if (mensagemErro || !edicao) {
    return (
      <p className="text-sm text-destructive">
        {mensagemErro ?? "Régua de férias não encontrada."}
      </p>
    );
  }

  return (
    <section aria-labelledby="titulo-regua-ferias" className="space-y-5">
      <div className="space-y-1">
        <h2 id="titulo-regua-ferias" className="text-base font-semibold text-foreground">
          Régua de alertas de férias
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada marco gera um alerta. A demanda do período é aberta no primeiro marco e atualizada
          nos seguintes, para a coordenação da unidade.
        </p>
      </div>

      <form onSubmit={(evento) => void aoSalvar(evento)} className="space-y-4" noValidate>
        <ul className="divide-y divide-border rounded-md border border-border">
          {MARCOS_DA_TELA.map(({ tipo, rotulo, descricao, temDias }) => {
            const idDias = `regua-${tipo}-dias`;
            return (
              <li key={tipo} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {temDias && (
                      <Input
                        id={idDias}
                        aria-label={`Dias: ${rotulo}`}
                        type="number"
                        min={1}
                        max={365}
                        className="h-8 w-20"
                        value={edicao[tipo].dias}
                        onChange={(evento) => alterar(tipo, { dias: evento.target.value })}
                      />
                    )}
                    <span>{rotulo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{descricao}</p>
                  {erroPorMarco[tipo] && (
                    <p className="text-xs text-destructive">{erroPorMarco[tipo]}</p>
                  )}
                </div>
                <Switch
                  aria-label={`Ativar: ${temDias ? `${edicao[tipo].dias} ${rotulo}` : rotulo}`}
                  checked={edicao[tipo].ativo}
                  onCheckedChange={(ativo) => alterar(tipo, { ativo })}
                />
              </li>
            );
          })}
        </ul>

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={salvando || !mudou}
            onClick={() => {
              limparErros();
              setEditado(false);
              if (marcos) setEdicao(edicaoDosMarcos(marcos));
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando || !mudou}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </section>
  );
}
