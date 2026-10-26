"use client";

import { useEffect, useState, type RefObject } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ativarPush,
  desativarPush,
  estadoDoPush,
  type EstadoPush,
} from "@/lib/pushNotificacoes";
import { useAppInstalado } from "./InstalarAppDialog";

const O_QUE_CHEGA = [
  "Demandas atribuídas a você e pedidos de aprovação",
  "Comentários e mudanças de status nas suas demandas",
  "Cards de absenteísmo da sua unidade, para a coordenação",
];

const MENSAGEM: Partial<Record<EstadoPush, string>> = {
  "precisa-instalar":
    "No iPhone e no iPad, as notificações só funcionam com o Atlas instalado na tela de início. Instale, abra o Atlas pelo ícone e volte aqui para ativar.",
  "nao-suportado":
    "Este navegador não recebe notificações. No Android, use o Chrome; ou instale o Atlas na tela de início.",
  indisponivel: "As notificações no celular ainda não estão disponíveis.",
  bloqueado:
    "As notificações do Atlas estão bloqueadas neste aparelho. Para liberar, abra as configurações do navegador (ou do app instalado), procure Notificações e permita para o Atlas.",
  ativado: "Ativadas neste aparelho.",
};

/**
 * Só monta com a janela aberta: o estado é lido do aparelho a cada abertura
 * (a pessoa pode ter liberado a permissão nas configurações nesse meio-tempo).
 */
function Conteudo({ onInstalar }: { onInstalar: () => void }) {
  const appInstalado = useAppInstalado();
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    estadoDoPush(appInstalado)
      .then((lido) => ativo && setEstado(lido))
      .catch(() => ativo && setEstado("nao-suportado"));
    return () => {
      ativo = false;
    };
  }, [appInstalado]);

  async function alternar() {
    setEnviando(true);
    try {
      if (estado === "ativado") {
        await desativarPush();
        setEstado("desativado");
        toast.success("Notificações desativadas neste aparelho.");
      } else {
        const novo = await ativarPush();
        setEstado(novo);
        if (novo === "ativado") toast.success("Notificações ativadas neste aparelho.");
      }
    } catch {
      toast.error("Não foi possível alterar as notificações. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <p className="font-medium">O que chega no celular:</p>
        <ul className="list-disc space-y-1 pl-5">
          {O_QUE_CHEGA.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Das 20h às 7h nada chega. O que acontecer à noite vem num resumo às 7h. O que é
          confidencial chega sem detalhes; o conteúdo fica no Atlas.
        </p>
      </div>

      <div className="space-y-3 border-t pt-3" aria-live="polite">
        {estado === null ? (
          <p className="text-muted-foreground">Verificando este aparelho...</p>
        ) : (
          MENSAGEM[estado] && <p>{MENSAGEM[estado]}</p>
        )}
        {estado === "precisa-instalar" && (
          <Button type="button" variant="outline" onClick={onInstalar}>
            Ver como instalar
          </Button>
        )}
        {(estado === "desativado" || estado === "ativado") && (
          <Button
            type="button"
            variant={estado === "ativado" ? "outline" : "default"}
            disabled={enviando}
            onClick={() => void alternar()}
          >
            {estado === "ativado" ? "Desativar" : "Ativar notificações"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Notificações no celular (STC-851), pelo menu "Mais" da barra do celular. */
export function NotificacoesCelularDialog({
  aberto,
  onOpenChange,
  focoAoFechar,
  onInstalar,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Botão do menu que abriu a janela: o item clicado já não existe ao fechar. */
  focoAoFechar: RefObject<HTMLElement | null>;
  /** iPhone fora do app: troca esta janela pelas instruções de instalação. */
  onInstalar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onCloseAutoFocus={(evento) => {
          evento.preventDefault();
          focoAoFechar.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" aria-hidden />
            Notificações no celular
          </DialogTitle>
          <DialogDescription>
            Avisos do Atlas no celular, mesmo com ele fechado.
          </DialogDescription>
        </DialogHeader>
        {aberto && <Conteudo onInstalar={onInstalar} />}
      </DialogContent>
    </Dialog>
  );
}
