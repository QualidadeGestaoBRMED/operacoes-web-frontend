"use client";

import { useId, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AvatarUsuario } from "@/components/AvatarUsuario";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type FonteComentarios,
  useComentariosDaFonte,
  useCriarComentario,
} from "@/hooks/useComentarios";
import { extrairMensagemErro } from "@/lib/erros";
import { formatarDataHora, iniciaisDe, nomeOuRemovido } from "@/lib/utils";

export function ComentarioFeed({
  fonte,
  podeComentar,
  aviso,
}: {
  /** A demanda (fonteDaDemanda) ou outra rota que grava nos comentários dela. */
  fonte: FonteComentarios;
  podeComentar: boolean;
  /** Texto fixo acima do campo de envio (ex.: o que não registrar ali). */
  aviso?: string;
}) {
  const { comentarios, isLoading, mensagemErro } = useComentariosDaFonte(fonte);
  const { criar, isLoading: enviando } = useCriarComentario(fonte);
  const [texto, setTexto] = useState("");
  const idAviso = useId();

  async function enviar() {
    const valor = texto.trim();
    if (!valor || enviando) return;
    try {
      await criar(valor);
      setTexto("");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia, Shift+Enter quebra linha -- mesmo padrão do mockup.
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      void enviar();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="scrollbar-discreta flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando comentários...</p>
        ) : mensagemErro ? (
          <p className="text-sm text-destructive">{mensagemErro}</p>
        ) : comentarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
        ) : (
          comentarios.map((comentario) => (
            <div key={comentario.id} className="flex gap-2.5">
              <AvatarUsuario
                imagem={comentario.usuario?.foto_url}
                iniciais={iniciaisDe(nomeOuRemovido(comentario.usuario))}
                className="bg-secondary text-[11px] font-bold text-secondary-foreground"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {nomeOuRemovido(comentario.usuario)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatarDataHora(comentario.created_at)}
                  </span>
                </div>
                <div className="rounded-r-lg rounded-bl-lg bg-muted/50 px-3.5 py-2.5 text-sm whitespace-pre-wrap text-foreground">
                  {comentario.texto}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {podeComentar && aviso && (
        <p id={idAviso} className="border-t border-border px-5 pt-2.5 text-xs text-muted-foreground">
          {aviso}
        </p>
      )}
      {podeComentar && (
        <div
          className={`flex items-end gap-2.5 px-5 py-3 ${aviso ? "" : "border-t border-border"}`}
        >
          <Textarea
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Adicionar comentário... (Enter para enviar)"
            aria-describedby={aviso ? idAviso : undefined}
            rows={1}
            className="max-h-28 min-h-9 resize-none"
          />
          <Button
            size="icon-sm"
            onClick={() => void enviar()}
            disabled={!texto.trim() || enviando}
            title="Enviar"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
