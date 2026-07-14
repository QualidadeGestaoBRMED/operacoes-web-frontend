"use client";

import { Suspense } from "react";
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
      onClick={() => signIn("google", { redirectTo: callbackUrl || "/hub" })}
    >
      <GoogleIcon />
      Entrar com Google
    </Button>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full flex-col items-center gap-8 sm:w-[350px]">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-primary">Atlas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Plataforma de Operações · BR MED
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
  );
}
