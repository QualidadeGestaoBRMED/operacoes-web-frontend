"use client";

import { useEffect, useState } from "react";
import { Eye, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { encerrarVerComo } from "@/lib/plataforma";
import { lerAvisoDeFim, sairDoVerComo } from "@/lib/verComo";

// Ao sair, o Admin volta para a lista de usuários, de onde começou.
export const DESTINO_AO_SAIR = "/admin/permissoes";

const FORMATADOR_HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/**
 * Faixa do "ver como" (STC-790), no topo de todas as telas enquanto o Admin
 * Q&G vê o Atlas como outra pessoa: quem, que é só leitura, até quando, e o
 * Sair. Fora do "ver como", mostra uma vez o aviso de quando ele terminou
 * sozinho (venceu, ou o backend o encerrou).
 */
export function FaixaVerComo() {
  const { verComo } = useAuth();
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const aviso = lerAvisoDeFim();
    if (aviso) toast.info(aviso);
  }, []);

  // Venceu com a tela aberta: volta a ser o Admin sem esperar a próxima
  // requisição.
  useEffect(() => {
    if (!verComo) return;
    const restante = Date.parse(verComo.expira_em) - Date.now();
    const temporizador = window.setTimeout(
      () => sairDoVerComo(DESTINO_AO_SAIR, "O ver como terminou: passou o tempo de 1 hora."),
      Math.max(0, restante),
    );
    return () => window.clearTimeout(temporizador);
  }, [verComo]);

  if (!verComo) return null;

  async function sair() {
    if (!verComo) return;
    setSaindo(true);
    try {
      await encerrarVerComo(verComo.id);
    } catch {
      // Encerrar no backend falhou (rede): a sessão vence sozinha em até 1
      // hora, e esta aba já deixa de mandar o cabeçalho.
    }
    sairDoVerComo(DESTINO_AO_SAIR);
  }

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-1.5 text-sm text-amber-950"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Eye aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0">
          Vendo como <strong className="font-semibold">{verComo.usuario.nome}</strong> (somente
          leitura) · até {FORMATADOR_HORA.format(new Date(verComo.expira_em))}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void sair()}
        disabled={saindo}
        className="flex items-center gap-1 rounded-md bg-amber-950/10 px-2 py-0.5 font-semibold hover:bg-amber-950/20 disabled:opacity-60"
      >
        <LogOut aria-hidden className="size-3.5" />
        {saindo ? "Saindo..." : "Sair"}
      </button>
    </div>
  );
}
