"use client";

import { Suspense } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const MENSAGENS_ERRO: Record<string, string> = {
  AccessDenied: "Acesso restrito a e-mails @grupobrmed.com.br.",
  BackendAuthError: "Não foi possível confirmar sua conta com o servidor. Tente novamente em instantes.",
  Default: "Não foi possível entrar. Tente novamente.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.64v2.99h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.87-2.99c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.28v3.09A11.998 11.998 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.31A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.58.38-2.31V6.6H1.28A11.998 11.998 0 0 0 0 12c0 1.94.47 3.77 1.28 5.4l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.6l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function MensagemErro() {
  const searchParams = useSearchParams();
  const erro = searchParams.get("error");
  const mensagemErro = erro ? (MENSAGENS_ERRO[erro] ?? MENSAGENS_ERRO.Default) : null;

  if (!mensagemErro) return null;

  return (
    <p className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
      {mensagemErro}
    </p>
  );
}

function BotaoEntrar() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  return (
    <Button
      className="w-full"
      onClick={() =>
        // Hub escondido por enquanto -- ver Sidebar.tsx. Voltar pra "/hub"
        // quando reativar.
        signIn("google", { redirectTo: callbackUrl || "/modulos/gestao-demandas" })
      }
    >
      <GoogleIcon />
      Entrar com Google
    </Button>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh">
      {/* Achado no review: background-image via CSS perde a otimização do
          next/image (formato automático, srcset responsivo). relative +
          fill + object-cover reproduz o mesmo visual de antes (bg-cover),
          com bg-sidebar por trás como fallback caso a imagem demore/falhe. */}
      <div className="relative hidden w-1/2 flex-col overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex">
        {/* Achado (bug reportado pelo usuário): sizes="50vw" otimiza pela
            LARGURA do painel (metade da tela), mas o painel é bem mais alto
            que largo e a imagem-fonte é widescreen (16:9) -- object-cover
            precisa cobrir a ALTURA, não a largura. Num viewport comum
            (ex.: 1440x900), isso pedia uma imagem de ~720x405 pro Next.js
            pra cobrir uma caixa de 720x900: o CSS esticava esse resultado
            2.2x pra cobrir a altura, só que os pixels de verdade continuavam
            na resolução baixa pedida pela largura -- daí o borrão. sizes
            maior força o Next a servir do balde de resolução seguinte
            (até o tamanho real da fonte, 1920px), com folga suficiente pra
            cobrir a altura sem upscale. Sem custo real: a imagem já é
            priority (carrega sempre, sem lazy) e só existe uma instância
            dela na página. */}
        <Image
          src="/brand/degrade-login.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* z-10: o Image de fundo acima é position:absolute (fill) -- sem
            isso, ele pintaria por cima do conteúdo estático (regra de
            stacking do CSS: elemento posicionado pinta depois do conteúdo
            estático em fluxo normal, mesmo vindo antes no DOM). */}
        <div className="relative z-10 flex h-full flex-col">
          <Image
            src="/brand/logo-brmed.webp"
            alt="BR MED Saúde Corporativa"
            width={220}
            height={50}
            priority
            className="h-12 w-auto self-start"
          />

          <div className="mt-16">
            {/* p, não h1 -- o h1 de verdade da página é o "Atlas" do painel
                direito; esse painel é decorativo/oculto no mobile. */}
            <p className="text-3xl font-bold">
              Atlas <span className="font-normal">- A Plataforma de Operações da BR MED.</span>
            </p>
            <p className="mt-4 text-lg text-sidebar-foreground/80">
              Processos, indicadores e ações em um só lugar.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="flex w-full flex-col items-center gap-8 sm:w-[350px]">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tight text-primary">Atlas</h1>
            <p className="mt-2 text-base font-medium text-foreground">
              Plataforma de Operações · <span className="font-semibold">BR MED</span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Faça login com sua conta Google Corporativa para continuar.
            </p>
          </div>

          <Suspense fallback={null}>
            <MensagemErro />
          </Suspense>

          <Suspense fallback={<Button className="w-full" disabled><GoogleIcon />Entrar com Google</Button>}>
            <BotaoEntrar />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
