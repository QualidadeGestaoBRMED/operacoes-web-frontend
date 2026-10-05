"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useReguaFerias } from "@/hooks/useParametrosGestaoRH";
import { ErroAoCarregar, MensagemErro } from "./mensagens";
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

const DIAS_MINIMO = 1;
const DIAS_MAXIMO = 365;

// Campo vazio não vira 0 no envio: a mensagem aparece na linha do marco.
function errosDeDias(edicao: Edicao): Partial<Record<TipoMarcoEditavel, string>> {
  const erros: Partial<Record<TipoMarcoEditavel, string>> = {};
  for (const { tipo, temDias } of MARCOS_DA_TELA) {
    if (!temDias) continue;
    const texto = edicao[tipo].dias.trim();
    const dias = Number(texto);
    if (texto === "") erros[tipo] = "Informe os dias.";
    else if (!Number.isInteger(dias) || dias < DIAS_MINIMO || dias > DIAS_MAXIMO) {
      erros[tipo] = `Os dias vão de ${DIAS_MINIMO} a ${DIAS_MAXIMO}.`;
    }
  }
  return erros;
}

export function FormReguaFerias() {
  const { marcos, isLoading, mensagemErro, recarregar, salvar } = useReguaFerias();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState<string>();
  const [erroPorMarco, setErroPorMarco] = useState<Partial<Record<TipoMarcoEditavel, string>>>({});
  // Régua de onde a edição partiu. "Mudou" compara com ela, não com a
  // vigente recarregada: desfazer a alteração volta a "sem alteração" e
  // libera a tela para receber a versão que outro Admin salvou.
  const [base, setBase] = useState<VersaoMarcoRegua[]>();
  const [salvando, setSalvando] = useState(false);

  const mudou =
    !!base && !!edicao && JSON.stringify(edicao) !== JSON.stringify(edicaoDosMarcos(base));

  // Recarregar a régua (ex.: outro Admin salvou e a tela revalidou) não
  // substitui uma edição em andamento.
  useEffect(() => {
    if (marcos && !mudou) {
      setBase(marcos);
      setEdicao(edicaoDosMarcos(marcos));
    }
  }, [marcos, mudou]);

  function partirDe(novaBase: VersaoMarcoRegua[]) {
    setBase(novaBase);
    setEdicao(edicaoDosMarcos(novaBase));
  }

  function alterar(tipo: TipoMarcoEditavel, mudanca: Partial<{ dias: string; ativo: boolean }>) {
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
    const invalidos = errosDeDias(edicao);
    if (Object.keys(invalidos).length > 0) {
      setErroPorMarco(invalidos);
      return;
    }
    const payload: MarcoEditado[] = MARCOS_DA_TELA.map(({ tipo }) => ({
      tipo_marco: tipo,
      dias: Number(edicao[tipo].dias),
      ativo: edicao[tipo].ativo,
    }));
    setSalvando(true);
    try {
      const resultado = await salvar(payload);
      partirDe(resultado.dados.marcos);
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

  if (isLoading) return <Skeleton className="h-56 w-full" />;
  // Falha numa revalidação com dado em tela mantém a régua (e a edição).
  if (!edicao) {
    return (
      <ErroAoCarregar
        mensagem={mensagemErro ?? "Régua de férias não encontrada."}
        aoTentarNovamente={recarregar}
      />
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
            const idErro = `regua-${tipo}-erro`;
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
                        aria-invalid={!!erroPorMarco[tipo]}
                        aria-describedby={erroPorMarco[tipo] ? idErro : undefined}
                        value={edicao[tipo].dias}
                        onChange={(evento) => alterar(tipo, { dias: evento.target.value })}
                      />
                    )}
                    <span>{rotulo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{descricao}</p>
                  <MensagemErro id={idErro} texto={erroPorMarco[tipo]} />
                </div>
                <Switch
                  aria-label={`Ativar: ${temDias && edicao[tipo].dias.trim() ? `${edicao[tipo].dias.trim()} ${rotulo}` : rotulo}`}
                  checked={edicao[tipo].ativo}
                  onCheckedChange={(ativo) => alterar(tipo, { ativo })}
                />
              </li>
            );
          })}
        </ul>

        <MensagemErro texto={erro} />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={salvando || !mudou}
            onClick={() => {
              limparErros();
              if (marcos) partirDe(marcos);
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
