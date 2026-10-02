"use client";

import { useRef, useState } from "react";
import { Download, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useAnexos, useEnviarAnexo, useExcluirAnexo } from "@/hooks/useAnexos";
import { extrairMensagemErro } from "@/lib/erros";
import { urlAbsolutaDoAnexo } from "@/lib/demandas";
import { cn, formatarDataHora, formatarTamanhoArquivo, nomeOuRemovido } from "@/lib/utils";

// Mesma whitelist de EXTENSOES_ANEXO_PERMITIDAS (backend/demandas/
// serializers.py) -- só pro rótulo/cor do ícone e pro atributo "accept" do
// input (dica de UI, não validação: quem valida de verdade é o backend).
const COR_POR_EXTENSAO: Record<string, string> = {
  pdf: "bg-red-600",
  doc: "bg-blue-600",
  docx: "bg-blue-600",
  pptx: "bg-orange-600",
  xlsx: "bg-green-600",
  png: "bg-purple-600",
  jpg: "bg-purple-600",
  jpeg: "bg-purple-600",
};

function extensaoDe(nomeArquivo: string) {
  return nomeArquivo.includes(".") ? nomeArquivo.split(".").pop()!.toLowerCase() : "";
}

export function AnexoList({
  demandaId,
  podeAnexar,
}: {
  demandaId: number;
  podeAnexar: boolean;
}) {
  const { anexos, isLoading, mensagemErro } = useAnexos(demandaId);
  const { enviar, isLoading: enviando, progresso } = useEnviarAnexo(demandaId);
  const { excluir, isLoading: excluindo } = useExcluirAnexo(demandaId);
  const { user, isAdminOps } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  // ConfirmDialog substitui o window.confirm() de antes -- exclusão de
  // anexo é irreversível (o arquivo some do storage, diferente do soft
  // delete de Demanda), por isso a confirmação continua existindo.
  const [anexoParaExcluir, setAnexoParaExcluir] = useState<{
    id: number;
    nomeOriginal: string;
  } | null>(null);

  async function aoEscolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    try {
      await enviar(arquivo);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function confirmarExclusao() {
    if (!anexoParaExcluir) return;
    try {
      await excluir(anexoParaExcluir.id);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setAnexoParaExcluir(null);
    }
  }

  return (
    <div className="scrollbar-discreta flex-1 space-y-2 overflow-y-auto px-5 py-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando anexos...</p>
      ) : mensagemErro ? (
        <p className="text-sm text-destructive">{mensagemErro}</p>
      ) : anexos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo ainda.</p>
      ) : (
        anexos.map((anexo) => {
          const extensao = extensaoDe(anexo.nome_original);
          // Mesma regra do backend (dono ou admin) -- checada de novo lá,
          // isso aqui é só pra não oferecer um botão que vai dar 403.
          const podeExcluir =
            podeAnexar && (anexo.usuario?.id === user?.usuarioId || isAdminOps);
          return (
            <div
              key={anexo.id}
              className="flex items-center gap-3.5 rounded-lg border border-border bg-background p-2.5 transition-shadow hover:shadow-sm"
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white uppercase",
                  COR_POR_EXTENSAO[extensao] ?? "bg-muted-foreground",
                )}
              >
                {extensao || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-foreground">
                  {anexo.nome_original}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {formatarTamanhoArquivo(anexo.tamanho)} · enviado por{" "}
                  {nomeOuRemovido(anexo.usuario)} · {formatarDataHora(anexo.created_at)}
                </div>
              </div>
              <a
                href={urlAbsolutaDoAnexo(anexo.arquivo)}
                target="_blank"
                rel="noreferrer"
                download={anexo.nome_original}
                title="Baixar"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download className="size-4" />
              </a>
              {podeExcluir && (
                <button
                  type="button"
                  onClick={() =>
                    setAnexoParaExcluir({ id: anexo.id, nomeOriginal: anexo.nome_original })
                  }
                  disabled={excluindo}
                  title="Remover"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          );
        })
      )}

      {podeAnexar && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.pptx,.xlsx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(evento) => void aoEscolherArquivo(evento)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border-1.5 border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-secondary hover:text-secondary disabled:pointer-events-none disabled:opacity-50"
          >
            {enviando ? (
              <>
                <Paperclip className="size-3.5 animate-pulse" />
                {progresso ? `Enviando... ${Math.round(progresso * 100)}%` : "Enviando..."}
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Adicionar anexo
              </>
            )}
          </button>
        </>
      )}

      <ConfirmDialog
        open={anexoParaExcluir !== null}
        onOpenChange={(open) => !open && setAnexoParaExcluir(null)}
        titulo="Remover anexo"
        descricao={`Remover o anexo "${anexoParaExcluir?.nomeOriginal}"? Essa ação não pode ser desfeita.`}
        textoConfirmar="Remover"
        destrutivo
        isLoading={excluindo}
        onConfirmar={() => void confirmarExclusao()}
      />
    </div>
  );
}
