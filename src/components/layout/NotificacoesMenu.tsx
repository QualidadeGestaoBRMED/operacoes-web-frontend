"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { cn, formatarTempoRelativo } from "@/lib/utils";
import type { Notificacao } from "@/types";

export function NotificacoesMenu() {
  const router = useRouter();
  const { notificacoes, naoLidasCount, marcarComoLida, marcarTodasComoLidas } = useNotificacoes();

  function abrirNotificacao(notificacao: Notificacao) {
    void marcarComoLida(notificacao);
    if (notificacao.link) router.push(notificacao.link);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            naoLidasCount > 0 ? `Notificações (${naoLidasCount} não lidas)` : "Notificações"
          }
          className="relative text-sidebar-foreground hover:text-accent-foreground"
        >
          <Bell className="size-4" />
          {naoLidasCount > 0 && (
            <Badge
              aria-hidden="true"
              variant="destructive"
              className="absolute top-0.5 right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {naoLidasCount > 9 ? "9+" : naoLidasCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {/* sticky: o proprio DropdownMenuContent e o container com scroll
            (overflow-y-auto + max-h dinamico do Radix) -- sem precisar de
            outro wrapper, so fixar o cabecalho no topo dele. */}
        <div className="sticky top-0 z-10 -m-1 mb-1 flex items-center justify-between bg-popover px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notificações</DropdownMenuLabel>
          {naoLidasCount > 0 && (
            <button
              type="button"
              onClick={() => void marcarTodasComoLidas()}
              className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
            >
              <CheckCheck className="size-3.5" />
              Marcar todas como lidas
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notificacoes.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação por aqui.
          </p>
        ) : (
          notificacoes.map((notificacao) => (
            <DropdownMenuItem
              key={notificacao.id}
              onSelect={() => abrirNotificacao(notificacao)}
              className="flex flex-col items-start gap-0.5 whitespace-normal py-2"
            >
              <div className="flex w-full items-start gap-2">
                {!notificacao.lida && (
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-secondary" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    notificacao.lida ? "text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {notificacao.titulo}
                </span>
              </div>
              <span className="pl-3.5 text-xs text-muted-foreground">
                {formatarTempoRelativo(notificacao.created_at)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
