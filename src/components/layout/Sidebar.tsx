"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Lock, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MODULOS_FUTUROS } from "@/config/modulos-futuros";

// Hub escondido por enquanto (bloqueado de vez, ver src/app/(app)/hub/page.tsx):
// com um só módulo ativo, um painel agregador não tem o que agregar ainda.
// Componentes ficam intactos em src/app/(app)/hub/HubContent.tsx -- reativar:
// trocar o redirect de hub/page.tsx e mover "Hub" de volta pra cima como
// SidebarLink (e apontar os redirects de login/raiz pra "/hub" de novo).
const MODULOS_BLOQUEADOS = [{ nome: "Hub", icon: Home }, ...MODULOS_FUTUROS];

export function Sidebar() {
  const pathname = usePathname();
  const emGestaoDemandas = pathname.startsWith("/modulos/gestao-demandas");
  const { isAdminQG } = useAuth();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* pl-5.5: alinha o ícone da logo com os ícones dos links abaixo --
          nav tem p-3 (12px) + SidebarLink tem px-2.5 (10px) = 22px de
          inset até o ícone, mesmo valor aqui. */}
      <div className="flex h-20 items-center pr-3 pl-5.5">
        <Image
          src="/brand/logo-brmed.webp"
          alt="BR MED Saúde Corporativa"
          width={200}
          height={45}
          priority
          className="h-9 w-auto"
        />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-0">
        <div className="flex h-8 items-center px-2.5 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
          Menu Principal
        </div>

        <SidebarLink
          href="/modulos/gestao-demandas"
          icon={ClipboardList}
          label="Gestão de Demandas"
          active={emGestaoDemandas}
        />

        <div className="my-2.5 h-px bg-sidebar-border/40" />

        {MODULOS_BLOQUEADOS.map((modulo) => (
          <SidebarLinkBloqueado
            key={modulo.nome}
            icon={modulo.icon ?? Lock}
            label={modulo.nome}
          />
        ))}
      </nav>

      {/* STC-262: era texto fixo, sem função nenhuma e visível pra qualquer
          perfil -- achado no dogfooding. isAdminQG (não isLoading nem
          nenhum estado de transição): antes do useSession() resolver,
          isAdminQG já nasce false, então o link nunca "pisca" pra quem não
          é Admin Q&G, só aparece depois de confirmado. Aponta pro Django
          Admin (outra origem, por isso <a> normal, não <Link> do Next) --
          é login separado do Google usado no resto do Atlas, não
          compartilha sessão.

          Achado no code review do Tech Lead: NEXT_PUBLIC_API_URL é
          inlined em build time -- se a env vier ausente/vazia nesse
          build, todo mundo Admin Q&G veria um link pra "undefined/admin"
          até o próximo deploy. process.env.NEXT_PUBLIC_API_URL entra na
          condição também: sem a env, não mostra o bloco (falha fechada),
          em vez de expor um link quebrado em produção. */}
      {isAdminQG && process.env.NEXT_PUBLIC_API_URL && (
        <div className="mt-2 border-t border-sidebar-border p-3 pt-2.5">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary-foreground"
          >
            <Settings className="size-4 shrink-0" />
            Admin Q&amp;G
          </a>
        </div>
      )}
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary-foreground",
        active &&
          "bg-gradient-to-b from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-[0_1px_2px_0_rgb(0_0_0/.05),inset_0_1px_0_0_rgb(255_255_255/.12)] hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

function SidebarLinkBloqueado({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/30">
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="ml-auto shrink-0 rounded-sm bg-white/8 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-sidebar-foreground/50">
        em breve
      </span>
    </div>
  );
}
