import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Cabeçalho próprio, não o AppShell (sidebar+topbar do app principal) --
// achado direto do usuário testando: a sidebar do app não tem nenhuma
// utilidade aqui (nenhum item leva a algo relacionado à doc), e clicar num
// item dela tira da página sem querer. Documentação da API é referência
// técnica, não uma tela do fluxo operacional do Atlas.
//
// Classes copiadas 1:1 do header real de prontuai.grupobrmed.com.br/docs
// (inspecionado pelo usuário via DevTools) -- mesmo container/grid/gaps/
// paddings responsivos, não uma aproximação visual. Única mudança
// deliberada: o ícone fica ANTES do texto (não depois) porque este botão
// volta pro Atlas, não avança pra dentro de um app -- convenção de "voltar"
// é seta antes do texto, "avançar" é seta depois (o ProntuAI usa
// ArrowRight depois porque o botão dele entra no app).
export function CabecalhoApiDocs() {
  return (
    <header className="shrink-0 bg-[linear-gradient(135deg,#193B4F_0%,#007891_100%)]">
      <div className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 xl:px-8 2xl:px-10">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:gap-14">
          <div className="flex items-center gap-5">
            {/* h-9 w-auto (não uma caixa fixa h-12 w-36 + object-contain) --
                achado testando: nossa logo (1920x436px, proporção 4.4:1,
                bem mais larga que a do ProntuAI) ficava "sobrando" dentro de
                uma caixa 3:1, renderizando maior/diferente do esperado.
                h-9 é a mesma altura já usada pra essa logo em
                Sidebar.tsx -- só trava a altura, a largura segue a
                proporção real da imagem. */}
            <Image
              src="/brand/logo-brmed.webp"
              alt="BR MED Saúde Corporativa"
              width={200}
              height={45}
              priority
              className="h-9 w-auto"
            />
            <Badge
              variant="outline"
              className="ml-1 border-white/30 bg-white/10 text-white"
            >
              Documentação da API
            </Badge>
          </div>
          <div className="flex justify-start lg:justify-end">
            <Link
              href="/hub"
              className="inline-flex items-center gap-2 rounded-md bg-white/15 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="size-4" />
              Voltar ao Atlas
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
