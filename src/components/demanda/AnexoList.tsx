"use client";

import { useRef } from "react";
import { Download, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAnexos, useEnviarAnexo } from "@/hooks/useAnexos";
import { extrairMensagemErro } from "@/lib/erros";
import { urlAbsolutaDoAnexo } from "@/lib/demandas";
import { cn, formatarDataHora, formatarTamanhoArquivo, nomeExibicao } from "@/lib/utils";

// Mesma whitelist de EXTENSOES_ANEXO_PERMITIDAS (backend/demandas/
// serializers.py) -- só pro rótulo/cor do ícone e pro atributo "accept" do
// input (dica de UI, não validação: quem valida de verdade é o backend).
const COR_POR_EXTENSAO: Record<string, string> = {
  pdf: "bg-red-600",
  doc: "bg-blue-600",
  docx: "bg-blue-600",
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
  const { enviar, isLoading: enviando } = useEnviarAnexo(demandaId);
  const inputRef = useRef<HTMLInputElement>(null);

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
                  {nomeExibicao(anexo.usuario)} · {formatarDataHora(anexo.created_at)}
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
            </div>
          );
        })
      )}

      {podeAnexar && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
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
                Enviando...
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
    </div>
  );
}
