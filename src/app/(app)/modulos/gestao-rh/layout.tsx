import { EsperaASessao } from "@/components/gestao-rh/EsperaASessao";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <EsperaASessao>{children}</EsperaASessao>;
}
