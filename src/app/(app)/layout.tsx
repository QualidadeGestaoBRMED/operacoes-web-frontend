import { AjudaProvider } from "@/components/ajuda/AjudaProvider";
import { AppShell } from "@/components/layout/AppShell";
import { NovidadesProvider } from "@/components/novidades/NovidadesProvider";
import { artigosResumidos, lerArtigos } from "@/lib/conteudoAjuda";
import { lerNovidades, resumidas } from "@/lib/conteudoNovidades";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Novidades (STC-877) e Ajuda (STC-878): lidas aqui, no servidor; o
  // navegador recebe só o cabeçalho de cada uma, para o ponto no menu, a
  // janela de destaque e o botão (?).
  return (
    <NovidadesProvider novidades={resumidas(lerNovidades())}>
      <AjudaProvider artigos={artigosResumidos(lerArtigos())}>
        <AppShell>{children}</AppShell>
      </AjudaProvider>
    </NovidadesProvider>
  );
}
