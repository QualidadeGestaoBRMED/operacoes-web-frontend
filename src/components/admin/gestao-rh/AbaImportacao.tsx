"use client";

import { isAxiosError } from "axios";
import { CheckCircle2, FileSpreadsheet, Info, Upload, X, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useImportacoesVR, useLinhasRejeitadas } from "@/hooks/useImportacoesVR";
import { extrairMensagemErro } from "@/lib/erros";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  LIMITE_ENVIO_BYTES,
  RELATORIOS_VR,
  ROTULO_RELATORIO,
  periodoPadrao,
  type LoteImportacao,
  type RelatorioVR,
} from "@/lib/gestaoRHImportacao";
import { formatarDataHora, formatarTamanhoArquivo } from "@/lib/utils";
import { ErroAoCarregar, MensagemErro } from "./mensagens";

type CampoEnvio = RelatorioVR | "periodo_inicio" | "periodo_fim";
type ErrosEnvio = Partial<Record<CampoEnvio | "geral", string>>;

const CAMPOS_ENVIO: CampoEnvio[] = ["jornada", "abonos", "pendencias", "periodo_inicio", "periodo_fim"];

const COLUNAS_HISTORICO = [
  "Importado em",
  "Período",
  "Origem",
  "Linhas processadas",
  "Linhas rejeitadas",
  "Situação",
];

const SITUACAO: Record<LoteImportacao["status"], { rotulo: string; variante: "success" | "destructive" | "muted" }> = {
  concluida: { rotulo: "Concluída", variante: "success" },
  recusada: { rotulo: "Recusada", variante: "destructive" },
  processando: { rotulo: "Processando", variante: "muted" },
};

function textoOrigem(lote: LoteImportacao): string {
  if (lote.origem === "robo") return "Robô";
  if (lote.origem === "api") return "API";
  return lote.enviado_por ? `Manual · ${lote.enviado_por}` : "Manual";
}

function textoPeriodo(lote: LoteImportacao): string {
  return `${formatarDataISO(lote.periodo_inicio)} a ${formatarDataISO(lote.periodo_fim)}`;
}

// Tabela do modal: um lote com milhares de linhas rejeitadas travaria a
// tela; as primeiras bastam para achar o padrão do problema.
const LIMITE_LINHAS_REJEITADAS = 500;

/** Equipes que chegaram no lote sem categoria, com o atalho para a aba Equipes. */
function AvisoEquipesNovas({
  quantidade,
  aoIrParaEquipes,
}: {
  quantidade: number;
  aoIrParaEquipes?: () => void;
}) {
  const texto =
    quantidade === 1 ? "1 equipe nova sem categoria:" : `${quantidade} equipes novas sem categoria:`;
  return (
    <>
      {texto}{" "}
      {aoIrParaEquipes ? (
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={aoIrParaEquipes}
        >
          classificar na aba Equipes
        </button>
      ) : (
        "classifique na aba Equipes"
      )}
      .
    </>
  );
}

// Sem resposta do backend (rede) ou com o proxy da Vercel cortando a espera
// (502/503/504): o backend pode ter concluído o lote mesmo assim.
const MENSAGEM_RESULTADO_INCERTO =
  "Não foi possível confirmar o resultado. A importação pode ter sido concluída: confira o histórico antes de enviar de novo.";

function resultadoIncerto(erro: unknown): boolean {
  if (!isAxiosError(erro)) return false;
  const status = erro.response?.status;
  return status === undefined || status === 502 || status === 503 || status === 504;
}

/** 400 do DRF por campo; o resto (409, 413) vira mensagem geral. */
function errosDaResposta(erro: unknown): ErrosEnvio {
  if (resultadoIncerto(erro)) return { geral: MENSAGEM_RESULTADO_INCERTO };
  if (isAxiosError(erro) && erro.response?.status === 400) {
    const dados: unknown = erro.response.data;
    if (dados && typeof dados === "object") {
      const erros: ErrosEnvio = {};
      for (const [campo, valor] of Object.entries(dados)) {
        const texto = [valor].flat().filter((item) => typeof item === "string").join(" ");
        if (!texto) continue;
        if ((CAMPOS_ENVIO as string[]).includes(campo)) erros[campo as CampoEnvio] = texto;
        else erros.geral = [erros.geral, texto].filter(Boolean).join(" ");
      }
      if (Object.keys(erros).length > 0) return erros;
    }
  }
  return { geral: extrairMensagemErro(erro) };
}

export function AbaImportacao({ aoIrParaEquipes }: { aoIrParaEquipes?: () => void }) {
  const { lotes, isLoading, mensagemErro, recarregar, importar } = useImportacoesVR();
  const [periodo, setPeriodo] = useState(() => periodoPadrao());
  const [arquivos, setArquivos] = useState<Partial<Record<RelatorioVR, File>>>({});
  const [erros, setErros] = useState<ErrosEnvio>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<LoteImportacao | null>(null);
  // O lote fica guardado depois de fechar: sem isso, o modal mostraria
  // "não encontradas" durante a animação de saída.
  const [loteRejeitadas, setLoteRejeitadas] = useState<LoteImportacao | null>(null);
  const [rejeitadasAbertas, setRejeitadasAbertas] = useState(false);

  function verRejeitadas(lote: LoteImportacao) {
    setLoteRejeitadas(lote);
    setRejeitadasAbertas(true);
  }
  const entradas = useRef<Partial<Record<RelatorioVR, HTMLInputElement | null>>>({});

  const totalBytes = RELATORIOS_VR.reduce((soma, { valor }) => soma + (arquivos[valor]?.size ?? 0), 0);

  function escolherArquivo(relatorio: RelatorioVR, arquivo: File | undefined) {
    // O mesmo arquivo escolhido de novo precisa disparar o onChange.
    const entrada = entradas.current[relatorio];
    if (entrada) entrada.value = "";
    if (!arquivo) return;
    if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
      setErros((atual) => ({ ...atual, [relatorio]: "Envie o relatório em XLSX." }));
      return;
    }
    setArquivos((atual) => ({ ...atual, [relatorio]: arquivo }));
    setErros((atual) => ({ ...atual, [relatorio]: undefined, geral: undefined }));
    setResultado(null);
  }

  function removerArquivo(relatorio: RelatorioVR) {
    setArquivos((atual) => ({ ...atual, [relatorio]: undefined }));
    setResultado(null);
  }

  function mudarPeriodo(campo: "inicio" | "fim", valor: string) {
    setPeriodo((atual) => ({ ...atual, [campo]: valor }));
    setResultado(null);
  }

  function validar(): ErrosEnvio {
    const novos: ErrosEnvio = {};
    for (const { valor, rotulo } of RELATORIOS_VR) {
      if (!arquivos[valor]) novos[valor] = `Escolha o relatório de ${rotulo}.`;
    }
    if (!periodo.inicio) novos.periodo_inicio = "Informe o início do período.";
    if (!periodo.fim) novos.periodo_fim = "Informe o fim do período.";
    else if (periodo.inicio && periodo.inicio > periodo.fim) {
      novos.periodo_fim = "O fim do período não pode ser antes do início.";
    }
    if (Object.keys(novos).length === 0 && totalBytes > LIMITE_ENVIO_BYTES) {
      novos.geral = `Os 3 arquivos somam ${formatarTamanhoArquivo(totalBytes)}; pela tela o limite é ${formatarTamanhoArquivo(LIMITE_ENVIO_BYTES)}. Exporte um período menor.`;
    }
    return novos;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const novos = validar();
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    setEnviando(true);
    setResultado(null);
    try {
      const lote = await importar(
        { jornada: arquivos.jornada!, abonos: arquivos.abonos!, pendencias: arquivos.pendencias! },
        periodo.inicio,
        periodo.fim,
      );
      setResultado(lote);
      // Recusado, os arquivos ficam para corrigir o período e reenviar.
      if (lote.status === "concluida") setArquivos({});
    } catch (erro) {
      setErros(errosDaResposta(erro));
      if (resultadoIncerto(erro)) recarregar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-importacao" className="space-y-5">
      <div className="space-y-1">
        <h2 id="titulo-importacao" className="text-base font-semibold text-foreground">
          Importação dos relatórios do VR Pontomais
        </h2>
        <p className="text-sm text-muted-foreground">
          O robô envia os relatórios todos os dias. Use este envio quando ele falhar: exporte os 3
          relatórios do período no VR, com todas as equipes, e envie aqui. Os arquivos são
          processados e não ficam armazenados.
        </p>
      </div>

      <form onSubmit={(evento) => void enviar(evento)} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="imp-inicio">Início do período *</Label>
            <Input
              id="imp-inicio"
              type="date"
              value={periodo.inicio}
              onChange={(evento) => mudarPeriodo("inicio", evento.target.value)}
              aria-invalid={!!erros.periodo_inicio}
              aria-describedby={erros.periodo_inicio ? "imp-inicio-erro" : undefined}
            />
            <MensagemErro id="imp-inicio-erro" texto={erros.periodo_inicio} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-fim">Fim do período *</Label>
            <Input
              id="imp-fim"
              type="date"
              value={periodo.fim}
              onChange={(evento) => mudarPeriodo("fim", evento.target.value)}
              aria-invalid={!!erros.periodo_fim}
              aria-describedby={erros.periodo_fim ? "imp-fim-erro" : undefined}
            />
            <MensagemErro id="imp-fim-erro" texto={erros.periodo_fim} />
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          O mesmo período usado na exportação; o padrão é o do robô (dia 1 do mês anterior até ontem).
        </p>

        <ul className="grid gap-3 sm:grid-cols-3">
          {RELATORIOS_VR.map(({ valor, rotulo, dica }) => {
            const arquivo = arquivos[valor];
            const idErro = `imp-${valor}-erro`;
            return (
              <li
                key={valor}
                className={`flex flex-col gap-2 rounded-lg border px-3 py-3 ${
                  arquivo ? "border-border" : "border-dashed border-border"
                } ${erros[valor] ? "border-destructive" : ""}`}
              >
                <span className="text-sm font-medium text-foreground">{rotulo}</span>
                <input
                  ref={(elemento) => {
                    entradas.current[valor] = elemento;
                  }}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  aria-label={`Arquivo de ${rotulo}`}
                  aria-invalid={!!erros[valor]}
                  aria-describedby={erros[valor] ? idErro : undefined}
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(evento) => escolherArquivo(valor, evento.target.files?.[0])}
                />
                {arquivo ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileSpreadsheet aria-hidden className="size-4 shrink-0 text-secondary" />
                    <span className="min-w-0 flex-1 truncate" title={arquivo.name}>
                      {arquivo.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatarTamanhoArquivo(arquivo.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Remover o arquivo de ${rotulo}`}
                      disabled={enviando}
                      onClick={() => removerArquivo(valor)}
                    >
                      <X aria-hidden className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{dica} · XLSX</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-auto w-full"
                  disabled={enviando}
                  onClick={() => entradas.current[valor]?.click()}
                >
                  <Upload aria-hidden className="size-3.5" />
                  {arquivo ? `Trocar ${rotulo}` : `Selecionar ${rotulo}`}
                </Button>
                <MensagemErro id={idErro} texto={erros[valor]} />
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          Reimportar um período substitui os dados dele, só de quem aparece em cada relatório. O
          texto livre do motivo e das observações, onde podem vir diagnóstico e CID, é descartado na
          leitura.
        </p>

        <MensagemErro texto={erros.geral} />

        <div className="flex justify-end">
          <Button type="submit" disabled={enviando}>
            {enviando ? "Importando..." : "Importar relatórios"}
          </Button>
        </div>
      </form>

      {resultado && (
        <ResultadoImportacao
          lote={resultado}
          aoVerRejeitadas={() => verRejeitadas(resultado)}
          aoIrParaEquipes={aoIrParaEquipes}
        />
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Histórico</h3>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !lotes ? (
          <ErroAoCarregar
            mensagem={mensagemErro ?? "Histórico de importações não encontrado."}
            aoTentarNovamente={recarregar}
          />
        ) : (
          <div className="scrollbar-discreta overflow-x-auto rounded-lg border border-border">
            <table aria-label="Importações" className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {COLUNAS_HISTORICO.map((coluna) => (
                    <th key={coluna} scope="col" className="px-4 py-2.5">
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotes.length === 0 ? (
                  <tr>
                    <td colSpan={COLUNAS_HISTORICO.length} className="px-4 py-6 text-center text-muted-foreground">
                      Nenhuma importação ainda.
                    </td>
                  </tr>
                ) : (
                  lotes.map((lote) => (
                    <LinhaHistorico
                      key={lote.id}
                      lote={lote}
                      aoVerRejeitadas={() => verRejeitadas(lote)}
                      aoIrParaEquipes={aoIrParaEquipes}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalLinhasRejeitadas
        lote={loteRejeitadas}
        aberto={rejeitadasAbertas}
        aoFechar={() => setRejeitadasAbertas(false)}
      />
    </section>
  );
}

interface PropsDoLote {
  lote: LoteImportacao;
  aoVerRejeitadas: () => void;
  aoIrParaEquipes?: () => void;
}

function ResultadoImportacao({ lote, aoVerRejeitadas, aoIrParaEquipes }: PropsDoLote) {
  if (lote.status !== "concluida") {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 px-3 py-2.5 text-sm">
        <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-foreground">Importação recusada: nada foi gravado.</p>
          <p className="text-muted-foreground">{lote.motivo_recusa}</p>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
      <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-[color:var(--chart-3)]" />
      <div className="space-y-0.5">
        <p className="font-medium text-foreground">
          Importação concluída: {textoPeriodo(lote)}, {lote.linhas_processadas.toLocaleString("pt-BR")} linhas
          processadas.
        </p>
        {lote.linhas_rejeitadas > 0 && (
          <p className="text-muted-foreground">
            {lote.linhas_rejeitadas === 1 ? "1 linha rejeitada" : `${lote.linhas_rejeitadas} linhas rejeitadas`}.{" "}
            <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={aoVerRejeitadas}>
              Ver linhas rejeitadas
            </button>
          </p>
        )}
        {lote.equipes_novas.length > 0 && (
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-secondary" />
            <span>
              <AvisoEquipesNovas quantidade={lote.equipes_novas.length} aoIrParaEquipes={aoIrParaEquipes} />
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function LinhaHistorico({ lote, aoVerRejeitadas, aoIrParaEquipes }: PropsDoLote) {
  const situacao = SITUACAO[lote.status];
  return (
    <tr className="border-b border-border align-top last:border-b-0">
      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
        {formatarDataHora(lote.concluido_em ?? lote.obtido_em)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{textoPeriodo(lote)}</td>
      <td className="px-4 py-3">{textoOrigem(lote)}</td>
      <td className="px-4 py-3 tabular-nums">{lote.linhas_processadas.toLocaleString("pt-BR")}</td>
      <td className="px-4 py-3 tabular-nums">
        {lote.linhas_rejeitadas > 0 ? (
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            aria-label={`Ver ${lote.linhas_rejeitadas} linhas rejeitadas da importação de ${textoPeriodo(lote)}`}
            onClick={aoVerRejeitadas}
          >
            {lote.linhas_rejeitadas.toLocaleString("pt-BR")} · ver
          </button>
        ) : (
          "0"
        )}
      </td>
      <td className="max-w-80 space-y-1 px-4 py-3">
        <Badge variant={situacao.variante}>{situacao.rotulo}</Badge>
        {lote.status === "recusada" && lote.motivo_recusa && (
          <p className="text-xs text-muted-foreground">{lote.motivo_recusa}</p>
        )}
        {lote.equipes_novas.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <AvisoEquipesNovas quantidade={lote.equipes_novas.length} aoIrParaEquipes={aoIrParaEquipes} />
          </p>
        )}
      </td>
    </tr>
  );
}

function ModalLinhasRejeitadas({
  lote,
  aberto,
  aoFechar,
}: {
  lote: LoteImportacao | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const { linhas, isLoading, mensagemErro } = useLinhasRejeitadas(lote?.id ?? null);
  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Linhas rejeitadas</DialogTitle>
          <DialogDescription>
            {lote && `Importação de ${textoPeriodo(lote)}. `}
            Essas linhas não entraram no Atlas; corrija no VR e importe de novo, se for o caso.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !linhas ? (
          <p className="text-sm text-destructive">{mensagemErro ?? "Linhas rejeitadas não encontradas."}</p>
        ) : (
          <div className="space-y-2">
            {linhas.length > LIMITE_LINHAS_REJEITADAS && (
              <p className="text-xs text-muted-foreground">
                Mostrando as {LIMITE_LINHAS_REJEITADAS} primeiras de {linhas.length.toLocaleString("pt-BR")}{" "}
                linhas rejeitadas.
              </p>
            )}
            <div className="scrollbar-discreta max-h-[60dvh] overflow-auto rounded-lg border border-border">
              <table aria-label="Linhas rejeitadas" className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0">
                  <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <th scope="col" className="px-4 py-2.5">Relatório</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Linha</th>
                    <th scope="col" className="px-4 py-2.5">Colaborador</th>
                    <th scope="col" className="px-4 py-2.5">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, LIMITE_LINHAS_REJEITADAS).map((linha, indice) => (
                    <tr
                      key={`${linha.relatorio}-${linha.linha}-${indice}`}
                      className="border-b border-border align-top last:border-b-0"
                    >
                      <td className="px-4 py-2.5">{ROTULO_RELATORIO[linha.relatorio]}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{linha.linha}</td>
                      <td className="px-4 py-2.5">{linha.colaborador || "Sem identificação"}</td>
                      <td className="px-4 py-2.5">{linha.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
