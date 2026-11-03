import { EsperaASessao } from "@/components/gestao-rh/EsperaASessao";
import { ExigeAcessoAoModulo } from "@/components/layout/ExigeAcessoAoModulo";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ExigeAcessoAoModulo codigo="gestao-rh">
      <EsperaASessao>{children}</EsperaASessao>
    </ExigeAcessoAoModulo>
  );
}
