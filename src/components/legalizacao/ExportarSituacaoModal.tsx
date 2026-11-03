"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { useUnidades } from "@/hooks/useUnidades";
import { baixarArquivo } from "@/lib/download";
import { extrairMensagemErro } from "@/lib/erros";
import {
  COLUNAS_EXPORTACAO,
  RECORTES_EXPORTACAO,
  colunasLembradas,
  exportarSituacao,
  lembrarColunas,
  type ColunaExportacao,
  type RecorteExportacao,
} from "@/lib/legalizacaoExportacao";
import { LABEL_CATEGORIA, ORDEM_CATEGORIA } from "@/lib/legalizacaoMatriz";
import { ROTULO_ABRANGENCIA, unidadesDoUsuario } from "@/lib/redes";
import type { CategoriaDocumento } from "@/types/legalizacao";

const COLUNAS_FIXAS = "Unidade, Categoria, Tipo de documento, Identificação, Situação e Validade";

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}

interface CaixasProps<T extends string | number> {
  legenda: string;
  opcoes: { valor: T; rotulo: string }[];
  marcados: T[];
  aoMudar: (marcados: T[]) => void;
}

function Caixas<T extends string | number>({ legenda, opcoes, marcados, aoMudar }: CaixasProps<T>) {
  return (
    <div
      role="group"
      aria-label={legenda}
      className="grid max-h-44 grid-cols-2 gap-x-4 gap-y-2 overflow-y-auto rounded-md border border-border p-3"
    >
      {opcoes.map((opcao) => {
        const id = `exportar-${legenda}-${opcao.valor}`;
        return (
          <div key={opcao.valor} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={marcados.includes(opcao.valor)}
              onCheckedChange={() => aoMudar(alternar(marcados, opcao.valor))}
            />
            <Label htmlFor={id} className="text-[13px] font-normal">
              {opcao.rotulo}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

interface TodasOuEscolherProps<T extends string | number> {
  titulo: string;
  textoTodas: string;
  opcoes: { valor: T; rotulo: string }[];
  escolhidas: T[] | null;
  aoMudar: (escolhidas: T[] | null) => void;
}

/** "Todas" (null) ou uma seleção de várias. */
function TodasOuEscolher<T extends string | number>({
  titulo,
  textoTodas,
  opcoes,
  escolhidas,
  aoMudar,
}: TodasOuEscolherProps<T>) {
  const nome = `exportar-${titulo}`;
  return (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-semibold text-foreground">{titulo}</legend>
      <div className="flex gap-4 text-[13px]">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={nome}
            checked={escolhidas === null}
            onChange={() => aoMudar(null)}
          />
          {textoTodas}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={nome}
            checked={escolhidas !== null}
            onChange={() => aoMudar([])}
          />
          Escolher
        </label>
      </div>
      {escolhidas !== null && (
        <Caixas legenda={titulo} opcoes={opcoes} marcados={escolhidas} aoMudar={aoMudar} />
      )}
    </fieldset>
  );
}

interface ExportarSituacaoModalProps {
  aberto: boolean;
  aoFechar: () => void;
}

export function ExportarSituacaoModal({ aberto, aoFechar }: ExportarSituacaoModalProps) {
  const { user, isCoordenacaoUnidade } = useAuth();
  const { rede, podeEscolher } = useRedeDaLegalizacao();
  // Quem vê as duas redes pode exportar as duas juntas; começa na da tela.
  const [asDuasRedes, setAsDuasRedes] = useState(false);
  const redeDaExportacao = podeEscolher && asDuasRedes ? undefined : rede;
  const { unidades: todasAsUnidades } = useUnidades(redeDaExportacao);
  // Coordenação só exporta as próprias unidades (o backend também recusa).
  const minhas = unidadesDoUsuario(user);
  const unidades = isCoordenacaoUnidade
    ? todasAsUnidades.filter((unidade) => minhas.includes(unidade.id))
    : todasAsUnidades;
  const travadaNaUnidade = isCoordenacaoUnidade && unidades.length === 1;

  const [recorte, setRecorte] = useState<RecorteExportacao>("todos");
  const [unidadesEscolhidas, setUnidadesEscolhidas] = useState<number[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDocumento[] | null>(null);
  const [colunas, setColunas] = useState<ColunaExportacao[]>(() =>
    colunasLembradas(user?.usuarioId),
  );
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A coluna Rede só existe para quem vê as duas redes.
  const opcoesDeColuna = COLUNAS_EXPORTACAO.filter(
    (coluna) => coluna.valor !== "rede" || podeEscolher,
  ).map(({ valor, rotulo }) => ({ valor, rotulo }));
  const faltaEscolher =
    (unidadesEscolhidas !== null && unidadesEscolhidas.length === 0) ||
    (categorias !== null && categorias.length === 0);

  async function exportar() {
    setExportando(true);
    setErro(null);
    const colunasPedidas = colunas.filter((coluna) => coluna !== "rede" || podeEscolher);
    try {
      const arquivo = await exportarSituacao({
        recorte,
        unidades: unidadesEscolhidas ?? [],
        categorias: categorias ?? [],
        colunas: colunasPedidas,
        rede: redeDaExportacao,
      });
      lembrarColunas(user?.usuarioId, colunas);
      baixarArquivo(arquivo);
      aoFechar();
    } catch (falha) {
      setErro(extrairMensagemErro(falha));
    } finally {
      setExportando(false);
    }
  }

  return (
    // Fechar (Esc, clique fora) espera a exportação terminar, como o
    // Cancelar: senão a planilha baixaria depois de a pessoa desistir.
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && !exportando && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Exportar situação</DialogTitle>
          <DialogDescription>
            Planilha com a situação dos documentos e, por unidade, os tipos ainda não cadastrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-foreground">O que exportar</legend>
            <div className="flex flex-wrap gap-4 text-[13px]">
              {RECORTES_EXPORTACAO.map((opcao) => (
                <label key={opcao.valor} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="exportar-recorte"
                    checked={recorte === opcao.valor}
                    onChange={() => setRecorte(opcao.valor)}
                  />
                  {opcao.rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          {podeEscolher && (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-semibold text-foreground">Rede</legend>
              <div className="flex flex-wrap gap-4 text-[13px]">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="exportar-rede"
                    checked={!asDuasRedes}
                    onChange={() => {
                      setAsDuasRedes(false);
                      setUnidadesEscolhidas(null);
                    }}
                  />
                  {ROTULO_ABRANGENCIA[rede]} (a da tela)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="exportar-rede"
                    checked={asDuasRedes}
                    onChange={() => {
                      setAsDuasRedes(true);
                      setUnidadesEscolhidas(null);
                    }}
                  />
                  {ROTULO_ABRANGENCIA.ambas}
                </label>
              </div>
            </fieldset>
          )}

          {travadaNaUnidade ? (
            <div className="space-y-1 text-[13px]">
              <p className="font-semibold text-foreground">Unidade</p>
              <p className="text-muted-foreground">{unidades[0].nome}</p>
            </div>
          ) : (
            <TodasOuEscolher
              titulo="Unidades"
              textoTodas={isCoordenacaoUnidade ? "Todas as minhas" : "Todas"}
              opcoes={unidades.map((unidade) => ({ valor: unidade.id, rotulo: unidade.nome }))}
              escolhidas={unidadesEscolhidas}
              aoMudar={setUnidadesEscolhidas}
            />
          )}

          <TodasOuEscolher
            titulo="Categorias"
            textoTodas="Todas"
            opcoes={ORDEM_CATEGORIA.map((categoria) => ({
              valor: categoria,
              rotulo: LABEL_CATEGORIA[categoria],
            }))}
            escolhidas={categorias}
            aoMudar={setCategorias}
          />

          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-foreground">Colunas</p>
            <p className="text-[12px] text-muted-foreground">Sempre entram: {COLUNAS_FIXAS}.</p>
            <Caixas
              legenda="Colunas"
              opcoes={opcoesDeColuna}
              marcados={colunas}
              aoMudar={setColunas}
            />
          </div>

          {erro && (
            <p role="alert" className="text-[13px] text-destructive">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={exportando}>
            Cancelar
          </Button>
          <Button onClick={exportar} disabled={exportando || faltaEscolher}>
            <Download className="size-4" aria-hidden />
            {exportando ? "Exportando…" : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão da barra comum de Mapa e Lista; só no computador. */
export function BotaoExportarSituacao() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden md:inline-flex"
        onClick={() => setAberto(true)}
      >
        <Download className="size-4" aria-hidden />
        Exportar situação
      </Button>
      {aberto && <ExportarSituacaoModal aberto={aberto} aoFechar={() => setAberto(false)} />}
    </>
  );
}
