"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal, RotateCw, Settings, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { moduloAtivo, useNavegacao } from "@/hooks/useNavegacao";
import { cn } from "@/lib/utils";

// Módulos na barra; os seguintes vão para o "Mais". Com 4 módulos e o
// "Mais", cada item fica com cerca de 75px numa tela de 375px.
export const MAXIMO_NA_BARRA = 4;

const ITEM =
  "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors";
const ITEM_INATIVO = "text-sidebar-foreground/60 hover:text-sidebar-foreground";
const ITEM_ATIVO = "text-sidebar-primary-foreground";

function Icone({
  icon: Icon,
  ativo,
}: {
  icon: React.ComponentType<{ className?: string }>;
  ativo: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
        ativo && "bg-sidebar-primary",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/**
 * Navegação do celular (STC-787), no lugar do menu lateral: um item por
 * módulo que a pessoa vê, pelo cargo (useNavegacao, a mesma regra do menu
 * lateral), e "Mais" com o que não cabe, a Administração, Recarregar e Sair.
 * Faz parte do layout (não flutua): o conteúdo nunca fica atrás dela.
 */
export function BarraInferior() {
  const pathname = usePathname();
  const { modulos, temAdministracao, linkDjangoAdmin } = useNavegacao();
  const naBarra = modulos.slice(0, MAXIMO_NA_BARRA);
  const noMais = modulos.slice(MAXIMO_NA_BARRA);
  const atual = moduloAtivo(modulos, pathname);
  // Fora de um módulo da barra (Administração, ou módulo que foi para o
  // "Mais"), o "Mais" fica ativo.
  const maisAtivo = !atual || noMais.includes(atual);

  return (
    <nav
      aria-label="Navegação principal"
      className="shrink-0 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex h-16">
        {naBarra.map((modulo) => {
          const ativo = modulo === atual;
          return (
            <li key={modulo.codigo} className="flex min-w-0 flex-1">
              <Link
                href={modulo.rota}
                aria-current={ativo ? "page" : undefined}
                className={cn(ITEM, ativo ? ITEM_ATIVO : ITEM_INATIVO)}
              >
                <Icone icon={modulo.icon} ativo={ativo} />
                <span className="w-full truncate text-center">{modulo.nomeCurto}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-current={maisAtivo ? "page" : undefined}
                className={cn(ITEM, maisAtivo ? ITEM_ATIVO : ITEM_INATIVO)}
              >
                <Icone icon={MoreHorizontal} ativo={maisAtivo} />
                <span>Mais</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="min-w-56">
              {noMais.map((modulo) => (
                <DropdownMenuItem key={modulo.codigo} asChild>
                  <Link
                    href={modulo.rota}
                    aria-current={modulo === atual ? "page" : undefined}
                  >
                    <modulo.icon className="size-4" />
                    {modulo.nome}
                  </Link>
                </DropdownMenuItem>
              ))}
              {temAdministracao && (
                <DropdownMenuItem asChild>
                  <Link href="/admin/permissoes">
                    <ShieldCheck className="size-4" />
                    Administração
                  </Link>
                </DropdownMenuItem>
              )}
              {linkDjangoAdmin && (
                <DropdownMenuItem asChild>
                  <a href={linkDjangoAdmin} target="_blank" rel="noopener noreferrer">
                    <Settings className="size-4" />
                    Admin Q&amp;G
                  </a>
                </DropdownMenuItem>
              )}
              {(noMais.length > 0 || temAdministracao || linkDjangoAdmin) && (
                <DropdownMenuSeparator />
              )}
              {/* No app instalado não há a barra do navegador nem o botão
                  de recarregar (STC-786), e o puxar para atualizar não
                  funciona no iPhone. */}
              <DropdownMenuItem onSelect={() => window.location.reload()}>
                <RotateCw className="size-4" />
                Recarregar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut({ redirectTo: "/login" })}>
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}
