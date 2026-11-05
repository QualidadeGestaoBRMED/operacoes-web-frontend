"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import {
  useAtualizarTipoDocumento,
  useCriarTipoDocumento,
} from "@/hooks/useTiposDocumento";
import { useAuth } from "@/hooks/useAuth";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { useSetores } from "@/hooks/useSetores";
import { extrairMensagemErro } from "@/lib/erros";
import {
  LABEL_CATEGORIA,
  ORDEM_CATEGORIA,
  rotuloDaAreaResponsavel,
} from "@/lib/legalizacaoMatriz";
import {
  podeEditarTipoDeDocumento,
  redesDaAbrangencia,
  ROTULO_ABRANGENCIA,
} from "@/lib/redes";
import type { Setor } from "@/types";
import type {
  AbrangenciaTipoDocumento,
  AreaResponsavelDocumento,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";

// Mesmo sentinel de GerenciarUsuarios.tsx (SEM_VALOR) -- Radix Select não
// aceita value="" pra representar "nenhum".
const SEM_SETOR = "nenhum";

// Espelha TipoDocumentoRegulatorio.AreaResponsavel (backend/legalizacao/
// models.py) -- só 2 valores, sem hook/endpoint próprio (é um choices fixo,
// igual Categoria).
const AREAS_RESPONSAVEIS: AreaResponsavelDocumento[] = ["legalizacao", "coordenacao"];

// Mesmo regex de um SlugField do Django (letras minúsculas, números e
// hífen) -- confere no client o que o backend já rejeitaria via
// TipoDocumentoRegulatorio.codigo (SlugField, unique).
const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Achado em code review: em modo edição, "codigo" fica disabled mas
// continua registrado no react-hook-form -- o valor pré-preenchido
// (valoresDe) segue validado no submit mesmo assim. Tipos cadastrados
// direto no banco/Django Admin (a própria razão desta issue existir) podem
// ter código fora deste regex (maiúscula, underscore) -- confirmado: já
// existem 3 assim no catálogo real. Sem schema condicional, abrir esse
// tipo pra editar qualquer OUTRO campo (ex. o Nome, o pedido de verdade)
// travava pra sempre num erro num campo que nem é editável na tela.
// "codigo" trocado de fato é bloqueado no backend de qualquer forma
// (TipoDocumentoRegulatorioSerializer.validate()), então validar o
// formato aqui em modo edição não protege nada.
function criarSchema(emEdicao: boolean) {
  return z.object({
    nome: z.string().min(1, "Nome é obrigatório."),
    codigo: emEdicao
      ? z.string().min(1, "Código é obrigatório.")
      : z
          .string()
          .min(1, "Código é obrigatório.")
          .regex(
            REGEX_SLUG,
            "Use só letras minúsculas, números e hífen (ex.: licenca-sanitaria).",
          ),
    categoria: z.enum(
      [
        "regularizacao",
        "registros_tecnicos",
        "capacitacao",
        "infraestrutura",
        "equipamentos",
        "programas",
        "residuos",
      ],
      { error: "Selecione a categoria." },
    ),
    area_responsavel: z.enum(["legalizacao", "coordenacao"], {
      error: "Selecione a área responsável.",
    }),
    abrangencia: z.enum(["padrao", "opex", "ambas"], {
      error: "Selecione onde o tipo é usado.",
    }),
    exige_validade: z.boolean(),
    exige_protocolo: z.boolean(),
    exige_evidencia: z.boolean(),
    permite_multiplas_instancias: z.boolean(),
    // STC-526: "nenhum" (sentinel do Select) vira null -- optional/nullable
    // no backend (TipoDocumentoRegulatorioSerializer.setor_apoio_id).
    setor_apoio_id: z.preprocess(
      (valor) => (valor === SEM_SETOR ? null : valor),
      z.coerce.number().int().positive().nullable(),
    ),
  });
}

type FormValuesEntrada = z.input<ReturnType<typeof criarSchema>>;
type FormValuesSaida = z.output<ReturnType<typeof criarSchema>>;

// Espelha os defaults de TipoDocumentoRegulatorio (backend/legalizacao/
// models.py): exige_validade/exige_evidencia nascem ligados, exige_protocolo
// nasce desligado -- maioria dos ~31 itens do catálogo seed segue esse
// padrão (licença/alvará tem validade e evidência, protocolo é exceção).
const valoresPadrao: Partial<FormValuesEntrada> = {
  exige_validade: true,
  exige_protocolo: false,
  exige_evidencia: true,
  permite_multiplas_instancias: false,
  setor_apoio_id: SEM_SETOR,
};

// STC-501: mesmo diálogo cadastra (tipoDocumento ausente) e edita
// (tipoDocumento presente) -- evita duplicar o formulário inteiro só pra
// trocar POST por PATCH. `codigo` fica travado em modo edição: é usado
// como chave fixa em código (CODIGOS_MOVIMENTACAO_PROFISSIONAL,
// legalizacaoMatriz.ts) pra CNES/Dosimetria/etc. -- mudar o código de um
// tipo já em uso quebraria esses comportamentos silenciosamente, e o
// pedido real do cliente é sobre o Nome (capitalização inconsistente),
// não o código interno.
// setores em vez de setor_apoio_id: TipoDocumentoRegulatorioSerializer só
// expõe `setor_apoio` (nome, read-only) -- setor_apoio_id é write-only
// (sem consumidor até esta issue). Casar pelo nome contra a lista de
// setores (useSetores) é o jeito de pré-preencher o Select sem precisar
// de nenhuma mudança no backend.
function valoresDe(
  tipo: TipoDocumentoRegulatorio,
  setores: Setor[],
): FormValuesEntrada {
  const setorApoio = setores.find((setor) => setor.nome === tipo.setor_apoio);
  return {
    nome: tipo.nome,
    codigo: tipo.codigo,
    categoria: tipo.categoria,
    area_responsavel: tipo.area_responsavel,
    abrangencia: tipo.abrangencia,
    exige_validade: tipo.exige_validade,
    exige_protocolo: tipo.exige_protocolo,
    exige_evidencia: tipo.exige_evidencia,
    permite_multiplas_instancias: tipo.permite_multiplas_instancias,
    setor_apoio_id: setorApoio ? String(setorApoio.id) : SEM_SETOR,
  };
}

export function FormNovoTipoDocumento({
  open,
  onOpenChange,
  tipoDocumento,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Ausente/null: modo cadastro (padrão). Presente: modo edição.
  tipoDocumento?: TipoDocumentoRegulatorio | null;
}) {
  const emEdicao = !!tipoDocumento;
  const { criar, isLoading: criando } = useCriarTipoDocumento();
  const { atualizar, isLoading: atualizando } = useAtualizarTipoDocumento();
  const isLoading = emEdicao ? atualizando : criando;
  const { setores } = useSetores();
  // STC-904: só as abrangências que quem edita pode usar (a mesma regra do
  // backend); um tipo novo nasce na rede escolhida nas telas.
  const { rede } = useRedeDaLegalizacao();
  const { redesAdministradas, isSetorLeg } = useAuth();
  const abrangencias = (
    Object.keys(ROTULO_ABRANGENCIA) as AbrangenciaTipoDocumento[]
  ).filter((abrangencia) =>
    podeEditarTipoDeDocumento(
      { redesAdministradas: redesAdministradas ?? [], isSetorLeg: Boolean(isSetorLeg) },
      abrangencia,
    ),
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(criarSchema(emEdicao)),
    defaultValues: valoresPadrao,
  });
  // O nome da área acompanha as redes escolhidas em "Usado em".
  const abrangenciaEscolhida = useWatch({ control, name: "abrangencia" });
  const redesDoTipo = abrangenciaEscolhida ? redesDaAbrangencia(abrangenciaEscolhida) : [rede];

  useEffect(() => {
    if (!open) {
      reset(valoresPadrao);
    } else if (tipoDocumento) {
      // keepDirtyValues: este formulário fica montado (só `hidden`/fechado)
      // em TabelaTiposDocumento.tsx -- o fetch de useSetores() começa
      // assim que a tela carrega, não quando o diálogo abre. Se "Editar"
      // for clicado antes desse fetch resolver, este reset roda 2x pro
      // mesmo tipoDocumento (setores=[] primeiro, depois a lista real) --
      // sem keepDirtyValues, o segundo reset apagaria qualquer campo que o
      // usuário já tivesse editado nessa janela (achado em code review).
      reset(valoresDe(tipoDocumento, setores), { keepDirtyValues: true });
    }
    // Achado em code review (STC-526): dependia de `setores` (o array
    // inteiro) -- useSetores() devolve `data ?? []`, que cria uma
    // referência NOVA a cada render enquanto `data` ainda está undefined
    // (SWR carregando). Combinado com o reset() acima disparando
    // re-render, virava um loop de resets a cada render até o fetch
    // resolver (risco real: sessão em que Setores nunca foi buscado antes,
    // ex. abrir "Editar" direto nesta tela sem nunca ter passado por
    // PermissoesAdmin). `.length` é estável durante o carregamento (0 em
    // todo render) e só muda de fato quando a lista real chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipoDocumento?.id, setores.length]);

  // Tipo novo nasce na rede escolhida nas telas. Só ao abrir, num efeito
  // à parte: o de cima roda de novo quando os setores chegam, e um reset
  // aqui apagaria o que a pessoa já digitou (code review da STC-894).
  useEffect(() => {
    if (open && !tipoDocumento) setValue("abrangencia", rede);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipoDocumento?.id]);

  async function aoSubmeter(valores: FormValuesSaida) {
    try {
      if (tipoDocumento) {
        await atualizar({ id: tipoDocumento.id, payload: valores });
        toast.success("Tipo de documento atualizado.");
      } else {
        await criar(valores);
        toast.success("Tipo de documento cadastrado.");
      }
      onOpenChange(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(30rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>
            {emEdicao ? "Editar tipo de documento" : "Novo tipo de documento"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-discreta flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="td-nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="td-nome"
                {...register("nome")}
                placeholder="Ex.: Licença Sanitária"
              />
              {errors.nome && (
                <p className="text-xs text-destructive">
                  {errors.nome.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-codigo">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                id="td-codigo"
                // Achado em code review: disabled tira o campo da ordem de
                // tabulação -- quem navega por teclado/leitor de tela pula
                // direto de "Nome" pra "Categoria", sem nunca focar "Código"
                // nem ouvir o valor atual ou o texto explicando por que está
                // travado. readOnly trava a edição sem remover o campo da
                // navegação (mantém foco/leitura), mesmo efeito prático.
                readOnly={emEdicao}
                aria-readonly={emEdicao}
                className={emEdicao ? "bg-muted text-muted-foreground" : undefined}
                {...register("codigo")}
                placeholder="Ex.: licenca-sanitaria"
              />
              {errors.codigo && (
                <p className="text-xs text-destructive">
                  {errors.codigo.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {emEdicao
                  ? "Não pode ser alterado depois de criado -- é usado internamente pra reconhecer tipos como CNES/Dosimetria."
                  : "Um código interno do sistema, só pra identificar esse tipo de documento. Não aparece pra quem for usar o catálogo depois."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-categoria">
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="categoria"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="td-categoria" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDEM_CATEGORIA.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {LABEL_CATEGORIA[categoria]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoria && (
                <p className="text-xs text-destructive">
                  {errors.categoria.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-area">
                Área responsável <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="area_responsavel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="td-area" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS_RESPONSAVEIS.map((area) => (
                        <SelectItem key={area} value={area}>
                          {rotuloDaAreaResponsavel(area, redesDoTipo)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.area_responsavel && (
                <p className="text-xs text-destructive">
                  {errors.area_responsavel.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-abrangencia">
                Usado em <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="abrangencia"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="td-abrangencia" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {abrangencias.map((abrangencia) => (
                        <SelectItem key={abrangencia} value={abrangencia}>
                          {ROTULO_ABRANGENCIA[abrangencia]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Cada rede tem o seu catálogo. Um tipo das duas redes aparece nos
                dois.
              </p>
              {errors.abrangencia && (
                <p className="text-xs text-destructive">{errors.abrangencia.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-setor-apoio">Setor de apoio</Label>
              <Controller
                control={control}
                name="setor_apoio_id"
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : SEM_SETOR}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="td-setor-apoio" className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_SETOR}>Nenhum</SelectItem>
                      {setores.map((setor) => (
                        <SelectItem key={setor.id} value={String(setor.id)}>
                          {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Além da unidade e da área responsável, pessoas deste setor
                também poderão ser escolhidas como Responsável Operacional nos
                documentos deste tipo.
              </p>
            </div>

            <div className="space-y-2.5">
              <Label>Exigências</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="exige_validade"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Exige validade
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="exige_protocolo"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Exige protocolo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="exige_evidencia"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Exige evidência
                </label>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label>Múltiplas instâncias por unidade</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="permite_multiplas_instancias"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Permite múltiplas instâncias
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Libera cadastro em lote (N documentos por unidade, ex.: um
                por equipamento). Não confundir com &ldquo;Controlado por
                profissional&rdquo; (Dosimetria) -- esse é outro mecanismo,
                que também liga o fluxo de Movimentação Profissional, e por
                isso não tem checkbox aqui: é uma decisão maior, fora do
                escopo deste cadastro.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {emEdicao
                ? isLoading
                  ? "Salvando..."
                  : "Salvar"
                : isLoading
                  ? "Cadastrando..."
                  : "Cadastrar tipo de documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
