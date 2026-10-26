import { AppShell } from "@/components/layout/AppShell";
import { NovidadesProvider } from "@/components/novidades/NovidadesProvider";
import { lerNovidades, resumidas } from "@/lib/conteudoNovidades";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Novidades (STC-877): lidas aqui, no servidor; o navegador recebe só o
  // cabeçalho de cada uma, para o ponto no menu e a janela de destaque.
  return (
    <NovidadesProvider novidades={resumidas(lerNovidades())}>
      <AppShell>{children}</AppShell>
    </NovidadesProvider>
  );
}
