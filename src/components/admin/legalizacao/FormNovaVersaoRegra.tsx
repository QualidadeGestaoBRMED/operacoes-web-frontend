"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  useAtualizarDocumentoLegalizacao,
  useDocumentosLegalizacao,
} from "@/hooks/useDocumentosLegalizacao";
import { useCriarRegraDocumento } from "@/hooks/useRegrasDocumento";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { excluirRegraDocumento } from "@/lib/legalizacaoCatalogo";
import type { DocumentoUnidade } from "@/types/legalizacao";

// STC-537: fallback caso o backend ainda não devolva o campo (deploy fora de
// ordem com STC-536) -- mesmo valor de sempre, agora só usado quando
// tipo_documento.antecedencia_padrao_dias vier undefined.
const ANTECEDENCIA_PADRAO_DIAS_FALLBACK = 60;

// "YYYY-MM-DD" (DateField do Django) formatado sem passar por Date -- mesmo
// motivo/mesma duplicação já aceita em PermissoesAdmin.tsx::formatarData
// (new Date("2026-03-05") interpreta como UTC meia-noite, que em fusos a
// oeste de UTC exibe o dia anterior ao real).
function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// "vigente_a_partir precisa ser depois da vigência atual" depende de um
// valor só conhecido em runtime (a regra do documento aberto) -- não dá pra
// expressar como .refine() estático (schema é compartilhado por qualquer
// documento). Checado à mão em aoSubmeter, não aqui.
// z.coerce.number() sozinho transforma "" (campo em branco) em 0, não
// undefined -- .optional() nunca entra em ação, e o campo "opcional" falhava
// a validação de min(1) mesmo vazio. preprocess intercepta "" antes da
// coerção, pra .optional() de fato funcionar.
const numeroDiaOpcional = z.preprocess(
  (valor) => (valor === "" ? undefined : valor),
  z.coerce.number().int().min(1).max(31).optional(),
);

const schema = z.object({
  antecedencia_dias: z.coerce.number({ error: "Obrigatória." }).int().min(0),
  janela_dia_inicio: numeroDiaOpcional,
  janela_dia_fim: numeroDiaOpcional,
  vigente_a_partir: z.string().min(1, "Obrigatório."),
  gera_card_demanda: z.boolean(),
});

type FormValuesEntrada = z.input<typeof schema>;
type FormValuesSaida = z.output<typeof schema>;

// Exportado (STC-502): DetalheDocumentoModal.tsx (Matriz de Conformidade)
// abre este mesmo diálogo direto pro documento já em mãos, sem passar
// pelos Selects de Unidade/Tipo de documento abaixo (só fazem sentido pro
// fluxo de catálogo, onde ainda não se sabe qual documento).
export function DialogNovaVersao({
  documento,
  open,
  onOpenChange,
  onAtualizado,
}: {
  documento: DocumentoUnidade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Opcional -- FormNovaVersaoRegra (catálogo) não precisa: já reage à
  // mudança via polling próprio (useDocumentosLegalizacao, pausado
  // enquanto o diálogo está aberto). DetalheDocumentoModal.tsx precisa de
  // um sinal explícito pra invalidar `documento`/histórico na hora, mesmo
  // motivo de onAtualizado em ProcessoRenovacaoModal/MovimentacaoProfissionalModal.
  onAtualizado?: () => void;
}) {
  const regraAtual = documento.regra_aplicada;
  const antecedenciaPadrao =
    documento.tipo_documento.antecedencia_padrao_dias ??
    ANTECEDENCIA_PADRAO_DIAS_FALLBACK;
  const { criar: criarRegra } = useCriarRegraDocumento();
  const { atualizar: atualizarDocumento } = useAtualizarDocumentoLegalizacao();
  const [salvando, setSalvando] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && regraAtual) {
      reset({
        // STC-523: deixa de reaproveitar o valor da regra atual (que pode
        // ser legado) -- nasce com a sugestão configurada pro tipo de
        // documento (STC-536/537, editável só via Django Admin), com
        // fallback pra 60.
        antecedencia_dias: antecedenciaPadrao,
        janela_dia_inicio: regraAtual.janela_dia_inicio ?? undefined,
        janela_dia_fim: regraAtual.janela_dia_fim ?? undefined,
        gera_card_demanda: regraAtual.gera_card_demanda,
        vigente_a_partir: undefined,
      });
    }
  }, [open, regraAtual, antecedenciaPadrao, reset]);

  async function aoSubmeter(valores: FormValuesSaida) {
    if (regraAtual && valores.vigente_a_partir <= regraAtual.vigente_a_partir) {
      setError("vigente_a_partir", {
        message: `Precisa ser depois de ${formatarData(regraAtual.vigente_a_partir)} (vigência atual).`,
      });
      return;
    }
    setSalvando(true);
    try {
      const novaRegra = await criarRegra({
        tipo_documento: documento.tipo_documento.id,
        unidade: documento.unidade.id,
        antecedencia_dias: valores.antecedencia_dias,
        // Sem campo próprio no formulário (fora do escopo desta issue,
        // ninguém usa hoje) -- carrega o valor da regra anterior adiante em
        // vez de descartar silenciosamente, caso já estivesse preenchido.
        periodicidade_meses: regraAtual?.periodicidade_meses ?? null,
        janela_dia_inicio: valores.janela_dia_inicio ?? null,
        janela_dia_fim: valores.janela_dia_fim ?? null,
        // STC-486: não é mais escolhido no formulário -- na prática toda
        // regra recebia "Alta" mesmo, então fixa o valor em vez de pedir pro
        // usuário (sem mudança no backend, "alta" já é um choice válido).
        criticidade: "alta",
        vigente_a_partir: valores.vigente_a_partir,
        gera_card_demanda: valores.gera_card_demanda,
      });
      try {
        await atualizarDocumento({
          id: documento.id,
          payload: { regra_aplicada: novaRegra.id },
        });
      } catch (erroAplicar) {
        // A regra nova já foi criada com sucesso -- se aplicá-la ao
        // documento falhar, desfaz em vez de deixar uma versão órfã (que
        // nunca chegou a valer) parada no catálogo. Best effort: se a
        // própria exclusão falhar, ignora e mostra o erro original.
        try {
          await excluirRegraDocumento(novaRegra.id);
        } catch {
          // Ignora.
        }
        throw erroAplicar;
      }
      toast.success("Nova versão da regra criada.");
      onAtualizado?.();
      onOpenChange(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(28rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Nova versão da regra</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-discreta flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <p className="text-sm text-muted-foreground">
              {documento.tipo_documento.nome} · {documento.unidade.nome}. A
              regra atual não é alterada: isto cria uma regra nova, que passa a
              valer a partir da data escolhida.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="nv-vigente">
                Vigente a partir <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nv-vigente"
                type="date"
                {...register("vigente_a_partir")}
              />
              {errors.vigente_a_partir && (
                <p className="text-xs text-destructive">
                  {errors.vigente_a_partir.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nv-antecedencia">Antecedência (dias)</Label>
              {/* STC-523: não é um input editável -- só exibe a sugestão
              vinda do tipo de documento (STC-536/537, default 60). Edição
              de verdade só via Django Admin, por tipo de documento, direto
              no banco. */}
              <Input
                id="nv-antecedencia"
                type="number"
                min={0}
                disabled
                {...register("antecedencia_dias")}
              />
              {errors.antecedencia_dias && (
                <p className="text-xs text-destructive">
                  {errors.antecedencia_dias.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nv-janela-inicio">Início da janela (dia)</Label>
                <Input
                  id="nv-janela-inicio"
                  type="number"
                  min={1}
                  max={31}
                  {...register("janela_dia_inicio")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nv-janela-fim">Fim da janela (dia)</Label>
                <Input
                  id="nv-janela-fim"
                  type="number"
                  min={1}
                  max={31}
                  {...register("janela_dia_fim")}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={control}
                name="gera_card_demanda"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              Gerar card em Gestão de Demandas quando o processo de renovação
              começar
            </label>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Criar nova versão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormNovaVersaoRegra() {
  const { user, isCoordenacaoUnidade } = useAuth();
  const { unidades: todasAsUnidades } = useUnidades("padrao");
  // STC-514: mesmo critério de FormCadastrarDocumento.tsx -- Coordenador só
  // pode corrigir regra da própria unidade.
  const unidades = isCoordenacaoUnidade
    ? todasAsUnidades.filter((unidade) => unidade.id === user?.unidade_id)
    : todasAsUnidades;
  const { tiposDocumento } = useTiposDocumento();
  const [unidadeId, setUnidadeId] = useState<number | undefined>();
  const [tipoDocumentoId, setTipoDocumentoId] = useState<number | undefined>();
  const [dialogAberto, setDialogAberto] = useState(false);

  // STC-514: campo de unidade travado na do Coordenador -- este componente
  // fica sempre montado (CatalogoLegalizacaoAdmin usa `hidden`, não
  // unmount), então não tem "open" pra depender -- só espera
  // isCoordenacaoUnidade/user resolverem (nascem false/undefined enquanto a
  // sessão carrega, useAuth.ts).
  useEffect(() => {
    if (
      !isCoordenacaoUnidade ||
      !user?.unidade_id ||
      unidadeId === user.unidade_id
    )
      return;
    setUnidadeId(user.unidade_id);
  }, [isCoordenacaoUnidade, user?.unidade_id, unidadeId]);

  const { documentos, isLoading, carregandoPrimeiraVez, error, mensagemErro } =
    useDocumentosLegalizacao(
      { unidade: unidadeId, tipo_documento: tipoDocumentoId },
      {
        desabilitado: !unidadeId || !tipoDocumentoId,
        // Achado no dogfooding: com o diálogo "Nova versão" aberto, o poll de
        // 60s (achado ao girar isso, backend às vezes muda regra_aplicada
        // enquanto a pessoa ainda está digitando) resetava o formulário no
        // meio do preenchimento -- pausa enquanto o diálogo estiver aberto.
        pausado: dialogAberto,
      },
    );
  const documento = documentos[0];

  return (
    <div className="flex min-h-0 flex-col">
      <div className="pb-2">
        <h2 className="text-base font-semibold text-foreground">
          Corrigir regra existente
        </h2>
        <p className="text-sm text-muted-foreground">
          Não é possível editar uma regra já cadastrada. Corrigir o prazo cria
          uma regra nova; a antiga fica guardada como histórico.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          value={unidadeId ? String(unidadeId) : undefined}
          onValueChange={(valor) => setUnidadeId(Number(valor))}
        >
          <SelectTrigger aria-label="Unidade" className="w-full">
            <SelectValue placeholder="Unidade..." />
          </SelectTrigger>
          <SelectContent>
            {unidades.map((unidade) => (
              <SelectItem key={unidade.id} value={String(unidade.id)}>
                {unidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={tipoDocumentoId ? String(tipoDocumentoId) : undefined}
          onValueChange={(valor) => setTipoDocumentoId(Number(valor))}
        >
          <SelectTrigger aria-label="Tipo de documento" className="w-full">
            <SelectValue placeholder="Tipo de documento..." />
          </SelectTrigger>
          <SelectContent>
            {tiposDocumento.map((tipo) => (
              <SelectItem key={tipo.id} value={String(tipo.id)}>
                {tipo.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!unidadeId || !tipoDocumentoId ? (
        // Achado no dogfooding visual: sem nenhuma pista, escolher os 2
        // campos parecia não fazer nada -- nenhuma seta, nenhum texto
        // avisando que o resultado aparece embaixo.
        <p className="pt-2 text-xs text-muted-foreground">
          Selecione a unidade e o tipo de documento para ver a regra atual.
        </p>
      ) : (
        <div className="mt-3 rounded-lg border border-border p-3 text-sm">
          {isLoading && carregandoPrimeiraVez ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : error ? (
            <p className="text-destructive">
              Não foi possível carregar o documento: {mensagemErro}
            </p>
          ) : documentos.length > 1 ? (
            // STC-432 (achado em análise própria de falhas críticas): tipos
            // controlado_por_profissional (Dosimetria) podem ter mais de um
            // documento pra esta combinação unidade+tipo, um por
            // profissional -- este fluxo foi desenhado assumindo no máximo
            // um. Escolher documentos[0] às cegas corrigiria a regra de um
            // profissional arbitrário sem avisar que os outros existem, e
            // reaproveitar essa regra em FormCadastrarDocumento.tsx pra um
            // profissional novo passaria a depender de qual documento a API
            // devolveu primeiro. Bloqueia até este fluxo suportar de fato
            // múltiplos documentos por combinação.
            <p className="text-muted-foreground">
              Este tipo de documento é controlado por profissional e tem{" "}
              {documentos.length} documentos cadastrados nesta unidade (um por
              profissional, mesma regra pra todos). Corrigir a regra por
              aqui ainda não tem suporte pra esse caso -- avisar o time
              técnico antes de tentar contornar isso criando uma regra
              separada.
            </p>
          ) : !documento ? (
            <p className="text-muted-foreground">
              Nenhum documento cadastrado para esta combinação. Use
              &quot;Cadastrar documento&quot; acima.
            </p>
          ) : !documento.regra_aplicada ? (
            <p className="text-muted-foreground">
              Este documento ainda não tem nenhuma regra de prazo cadastrada,
              então não há o que corrigir.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-muted-foreground">
                Vigente desde{" "}
                {formatarData(documento.regra_aplicada.vigente_a_partir)}, com{" "}
                {documento.regra_aplicada.antecedencia_dias} dias de
                antecedência.
              </div>
              <Button size="sm" onClick={() => setDialogAberto(true)}>
                Criar nova versão
              </Button>
            </div>
          )}
        </div>
      )}

      {documento && (
        <DialogNovaVersao
          documento={documento}
          open={dialogAberto}
          onOpenChange={setDialogAberto}
        />
      )}
    </div>
  );
}
