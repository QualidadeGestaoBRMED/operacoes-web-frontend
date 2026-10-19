import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { COR_DA_MARCA } from "@/lib/marca";
import { Providers } from "./providers";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atlas - BR MED",
  description: "Hub de operações BR MED",
  applicationName: "Atlas",
  // App instalado no iPhone ("Adicionar à Tela de Início"): tela cheia, com
  // o nome curto. Barra de status preta (não a translúcida): a translúcida
  // passaria o relógio por cima do topo do Atlas.
  appleWebApp: { capable: true, title: "Atlas", statusBarStyle: "black" },
};

// Cor da barra do sistema no app instalado e na barra do navegador.
export const viewport: Viewport = {
  themeColor: COR_DA_MARCA,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Lê headers() só pelo efeito colateral: isso tira o layout (e tudo
  // abaixo dele) da renderização estática -- achado buildando e checando o
  // HTML de verdade (STC-239): sem nenhuma API dinâmica sendo lida em
  // algum Server Component, /login e outras páginas continuavam
  // pré-renderizadas em build time, com os scripts inline que o próprio
  // Next injeta na hidratação sem nonce nenhum -- o navegador bloqueava
  // esses scripts por não bater com o nonce (novo a cada requisição) do
  // header da resposta montado em src/auth.ts.
  await headers();

  return (
    <html lang="pt-BR">
      <body className={`${geistMono.variable} antialiased`}>
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
