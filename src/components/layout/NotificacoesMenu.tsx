"use client";

import { useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { cn, formatarTempoRelativo } from "@/lib/utils";
import type { Notificacao } from "@/types";

export function NotificacoesMenu() {
  const router = useRouter();
  const { notificacoes, naoLidas, naoLidasCount, marcarComoLida, marcarTodasComoLidas } =
    useNotificacoes();
  // Achado no dogfooding: o painel virava uma parede de notificações
  // antigas já lidas -- "não lidas" é a visão padrão (dado que já vem
  // pronto do hook, sem chamada extra), "todas" continua um clique
  // distante pra quem quiser reconferir o histórico completo.
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const notificacoesExibidas = mostrarTodas ? notificacoes : naoLidas;

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
        <div className="sticky top-0 z-10 -m-1 mb-1 flex flex-col gap-1.5 bg-popover px-2 py-1.5">
          <div className="flex items-center justify-between">
            <DropdownMenuLabel className="p-0 text-sm font-semibold">
              Notificações
            </DropdownMenuLabel>
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
          <Tabs value={mostrarTodas ? "todas" : "nao-lidas"}>
            <TabsList className="h-7 w-full">
              <TabsTrigger
                value="nao-lidas"
                onClick={() => setMostrarTodas(false)}
                className="text-xs"
              >
                Não lidas{naoLidasCount > 0 && ` (${naoLidasCount})`}
              </TabsTrigger>
              <TabsTrigger value="todas" onClick={() => setMostrarTodas(true)} className="text-xs">
                Todas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <DropdownMenuSeparator />

        {notificacoesExibidas.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {mostrarTodas ? "Nenhuma notificação por aqui." : "Nenhuma notificação não lida."}
          </p>
        ) : (
          notificacoesExibidas.map((notificacao) => (
            <DropdownMenuItem
              key={notificacao.id}
              onSelect={() => abrirNotificacao(notificacao)}
              // group: DropdownMenuItem já troca o fundo pra bg-accent (teal)
              // no hover/foco, mas os <span> abaixo tinham cor própria
              // (text-foreground/text-muted-foreground) que não herdava
              // isso -- ficava com texto escuro/cinza quase ilegível em cima
              // do teal. group-focus:text-accent-foreground acompanha o
              // mesmo estado do item pai.
              className="group flex flex-col items-start gap-0.5 whitespace-normal py-2"
            >
              <div className="flex w-full items-start gap-2">
                {!notificacao.lida && (
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-secondary group-focus:bg-accent-foreground" />
                )}
                <span
                  className={cn(
                    "text-sm group-focus:text-accent-foreground",
                    notificacao.lida ? "text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {notificacao.titulo}
                </span>
              </div>
              <span className="pl-3.5 text-xs text-muted-foreground group-focus:text-accent-foreground/80">
                {formatarTempoRelativo(notificacao.created_at)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
