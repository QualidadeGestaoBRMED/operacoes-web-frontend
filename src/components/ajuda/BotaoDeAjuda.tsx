"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moduloAtivo } from "@/hooks/useNavegacao";
import { artigosDaTela } from "@/lib/ajuda";
import { useAjuda } from "./AjudaProvider";
import { PainelDeAjuda } from "./PainelDeAjuda";

const CLASSE = "text-sidebar-foreground hover:text-accent-foreground";

/**
 * Botão (?) no topo de cada tela (STC-878): abre o artigo da tela num painel
 * lateral. Tela sem artigo: leva à Ajuda, já no grupo do módulo, se houver.
 */
export function BotaoDeAjuda() {
  const pathname = usePathname();
  const { visiveis, modulos } = useAjuda();
  // Aberto na tela em que foi clicado. Trocar de tela fecha o painel de vez:
  // voltar a ela depois (pelo Voltar do navegador, por exemplo) não o reabre.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const [telaAnterior, setTelaAnterior] = useState(pathname);
  if (telaAnterior !== pathname) {
    setTelaAnterior(pathname);
    setAbertoEm(null);
  }
  const daTela = artigosDaTela(visiveis, pathname);
  const modulo = moduloAtivo(modulos, pathname);

  if (daTela.length === 0) {
    const temGrupo = modulo && visiveis.some((artigo) => artigo.modulo === modulo.codigo);
    return (
      <Button asChild variant="ghost" size="icon" className={CLASSE}>
        <Link href={temGrupo ? `/ajuda#grupo-${modulo.codigo}` : "/ajuda"} aria-label="Ajuda" title="Ajuda">
          <CircleHelp className="size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Ajuda desta tela"
        title="Ajuda desta tela"
        onClick={() => setAbertoEm(pathname)}
        className={CLASSE}
      >
        <CircleHelp className="size-4" />
      </Button>
      <PainelDeAjuda
        artigos={daTela}
        nomeDoModulo={modulo?.nome ?? null}
        aberto={abertoEm === pathname}
        onOpenChange={(abrir) => setAbertoEm(abrir ? pathname : null)}
      />
    </>
  );
}
