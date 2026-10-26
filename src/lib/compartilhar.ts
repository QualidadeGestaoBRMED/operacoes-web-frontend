import { toast } from "sonner";

/**
 * Compartilhar, como o "Share" do Linear (Novidades e Ajuda): no celular, a
 * folha de compartilhamento do sistema (WhatsApp, e-mail...); no computador,
 * copia o link.
 */
export async function compartilhar({
  titulo,
  texto,
  caminho,
  copiado,
}: {
  titulo: string;
  texto: string;
  caminho: string;
  /** Aviso depois de copiar ("Link da novidade copiado."). */
  copiado: string;
}) {
  const url = `${window.location.origin}${caminho}`;
  if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: titulo, text: texto, url });
      return;
    } catch (erro) {
      if ((erro as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success(copiado);
  } catch {
    toast.error("Não foi possível copiar o link.");
  }
}
