"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock, Settings, ShieldCheck } from "lucide-react";
import {
  subitemAtivo as acharSubitemAtivo,
  useNavegacao,
  type SubitemDeNavegacao,
} from "@/hooks/useNavegacao";
import { cn } from "@/lib/utils";

// onNavegar: opcional -- só o AppShell em modo overlay mobile passa algo
// (fecha o drawer ao escolher um destino); no modo "push" (desktop/tablet)
// não tem drawer pra fechar, então não é passado.
export function Sidebar({ onNavegar }: { onNavegar?: () => void } = {}) {
  const pathname = usePathname();
  // Módulos, subitens e links de Administração pelo cargo: a mesma regra
  // da barra inferior do celular (useNavegacao, STC-787).
  const { modulos, bloqueados, temAdministracao, linkDjangoAdmin } = useNavegacao();

  return (
    // h-full: achado no dogfooding do overlay mobile -- sem altura própria,
    // o <aside> só cobria a altura do próprio conteúdo (logo+nav+bloco
    // admin), bem menos que a tela inteira. No modo "push" isso não
    // aparecia (o fundo escuro por trás, bg-sidebar no wrapper raiz do
    // AppShell, coincidia com a mesma cor). No overlay mobile, o "resto"
    // sem cobertura deixava o backdrop semitransparente por baixo aparecer
    // -- sidebar parecia "repartida", com um pedaço embaixo translúcido.
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
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

        {modulos.map((modulo) =>
          modulo.subitens.length > 1 ? (
            <SidebarLinkExpansivel
              key={modulo.nome}
              href={modulo.rota}
              icon={modulo.icon}
              label={modulo.nome}
              subitens={modulo.subitens}
              pathname={pathname}
              onClick={onNavegar}
            />
          ) : (
            <SidebarLink
              key={modulo.nome}
              href={modulo.rota}
              icon={modulo.icon}
              label={modulo.nome}
              active={pathname.startsWith(modulo.rota)}
              onClick={onNavegar}
            />
          ),
        )}

        <div className="my-2.5 h-px bg-sidebar-border/40" />

        {bloqueados.map((modulo) => (
          <SidebarLinkBloqueado
            key={modulo.nome}
            icon={modulo.icon ?? Lock}
            label={modulo.nome}
          />
        ))}
      </nav>

      {/* isAdminOps (Admin de alguma rede) cobre os perfis que têm algum
          link aqui -- Admin Q&G é um caso particular dele,
          então o wrapper (borda/espaçamento) usa só essa condição, e cada
          link decide por conta própria se aparece. Coordenador (STC-514) e,
          desde a STC-519, Admin também -- não entram aqui: o acesso deles
          ao Catálogo de Legalização vive dentro do submenu de Legalização,
          não neste bloco (ver modulos.map acima). O link
          "Administração"/"Admin Operações" abaixo continua existindo (leva
          pra tela inteira, não só o Catálogo). */}
      {temAdministracao && (
        <div className="mt-2 flex flex-col gap-0.5 border-t border-sidebar-border p-3 pt-2.5">
          {/* STC-262: era texto fixo, sem função nenhuma e visível pra
              qualquer perfil -- achado no dogfooding. isAdminQG (não
              isLoading nem nenhum estado de transição): antes do
              useSession() resolver, isAdminQG já nasce false, então o link
              nunca "pisca" pra quem não é Admin Q&G, só aparece depois de
              confirmado. Aponta pro Django Admin (outra origem, por isso
              <a> normal, não <Link> do Next) -- é login separado do Google
              usado no resto do Atlas, não compartilha sessão.

              Achado no code review do Tech Lead: NEXT_PUBLIC_API_URL é
              inlined em build time -- se a env vier ausente/vazia nesse
              build, todo mundo Admin Q&G veria um link pra "undefined/admin"
              até o próximo deploy. process.env.NEXT_PUBLIC_API_URL entra na
              condição também: sem a env, não mostra o link (falha fechada),
              em vez de expor um link quebrado em produção. */}
          {linkDjangoAdmin && (
            <a
              href={linkDjangoAdmin}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavegar}
              className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary-foreground"
            >
              <Settings className="size-4 shrink-0" />
              Admin Q&amp;G
            </a>
          )}

          {/* STC-266: tela interna pra conceder/gerenciar permissões
              individuais temporárias (ex.: cobertura de férias entre
              unidades) sem depender do Django Admin -- hoje só o time de
              Q&G tem login configurado lá (ver conversa que motivou o
              STC-262). Mesmo rótulo para todo Admin (STC-747): os cargos
              de Admin por rede não cabiam no antigo "Admin Operações". */}
          <Link
            href="/admin/permissoes"
            onClick={onNavegar}
            className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary-foreground"
          >
            <ShieldCheck className="size-4 shrink-0" />
            Administração
          </Link>
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
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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

// STC-496: item de sidebar que expande um submenu, hoje só usado por
// Legalização (Matriz de Conformidade + Biblioteca de Documentos) -- não
// existe primitivo de accordion/collapsible em components/ui/ ainda, e
// construir um só pra este único uso seria abstração cedo demais. A
// animação usa o truque de grid-template-rows 0fr/1fr (só CSS, sem JS de
// altura), suficiente pro caso.
function SidebarLinkExpansivel({
  href,
  icon: Icon,
  label,
  subitens,
  pathname,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  subitens: SubitemDeNavegacao[];
  pathname: string;
  onClick?: () => void;
}) {
  const ativo = pathname.startsWith(href);
  // Sub-rota ativa = o match de prefixo mais específico (mais longo) entre
  // os subitens -- "/modulos/legalizacao" (Matriz) é prefixo de
  // "/modulos/legalizacao/biblioteca" também, então não dá pra usar só
  // startsWith isolado por item sem os dois "ganharem" ao mesmo tempo numa
  // rota da Biblioteca.
  const subitemAtivo = acharSubitemAtivo(subitens, pathname);
  const temSubitemAtivo = Boolean(subitemAtivo);
  const [expandido, setExpandido] = useState(ativo || temSubitemAtivo);

  // Auto-expande ao navegar pra dentro do módulo -- não colapsa sozinho ao
  // sair (deixa como o usuário deixou), só o clique manual no chevron
  // recolhe. Decisão registrada na issue: expandir sozinho quando uma rota
  // filha já está ativa. temSubitemAtivo entra aqui também (STC-514): o
  // Catálogo de Legalização (rota fora de /modulos/legalizacao, injetado
  // como subitem pro Coordenador) não bate no `ativo` acima -- sem isto, um
  // refresh direto em /admin/permissoes abria o submenu recolhido, com o
  // item ativo escondido dentro dele.
  useEffect(() => {
    if (ativo || temSubitemAtivo) setExpandido(true);
  }, [ativo, temSubitemAtivo]);

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Link
          href={href}
          onClick={onClick}
          aria-current={ativo ? "page" : undefined}
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary-foreground",
            ativo &&
              "bg-gradient-to-b from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-[0_1px_2px_0_rgb(0_0_0/.05),inset_0_1px_0_0_rgb(255_255_255/.12)] hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setExpandido((valor) => !valor)}
          aria-expanded={expandido}
          aria-label={expandido ? `Recolher ${label}` : `Expandir ${label}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform duration-200",
              expandido && "rotate-180",
            )}
          />
        </button>
      </div>
      <div
        // inert quando recolhido: o truque de grid-rows não tira os links
        // do layout/DOM, só zera a altura visível -- sem isto, Tab ainda
        // alcançava "Matriz de Conformidade"/"Biblioteca de Documentos"
        // fora de vista, um link invisível recebendo foco.
        inert={!expandido}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          expandido ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 ml-[1.125rem] flex flex-col gap-0.5 border-l border-sidebar-border/40 py-0.5 pl-3.5">
            {subitens.map((subitem) => (
              <Link
                key={subitem.rota}
                href={subitem.rota}
                onClick={onClick}
                aria-current={subitemAtivo?.rota === subitem.rota ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary-foreground",
                  subitemAtivo?.rota === subitem.rota &&
                    "bg-sidebar-accent text-sidebar-primary-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{subitem.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
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
