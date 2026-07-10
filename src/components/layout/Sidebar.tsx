"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Home,
  Lock,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODULOS_BLOQUEADOS = [
  { nome: "Legalização" },
  { nome: "Gestão RH" },
  { nome: "Manutenção" },
  { nome: "Indicadores", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const emHub = pathname === "/hub";
  const emGestaoDemandas = pathname.startsWith("/modulos/gestao-demandas");

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar p-3 text-sidebar-foreground">
      <div className="px-2 pb-6 text-xl font-bold tracking-wide">BR MED</div>

      <nav className="flex flex-1 flex-col gap-0.5">
        <SidebarLink href="/hub" icon={Home} label="Hub" active={emHub} />
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

      <div className="mt-2 border-t border-sidebar-border pt-2.5">
        <div className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/75">
          <Settings className="size-4 shrink-0" />
          Admin Q&amp;G
        </div>
      </div>
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
      {label}
      <span className="ml-auto rounded-sm bg-white/8 px-1.5 py-0.5 text-[10px] text-sidebar-foreground/50">
        em breve
      </span>
    </div>
  );
}
