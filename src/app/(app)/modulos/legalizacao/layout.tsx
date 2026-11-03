import { ExigeAcessoAoModulo } from "@/components/layout/ExigeAcessoAoModulo";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ExigeAcessoAoModulo codigo="legalizacao">{children}</ExigeAcessoAoModulo>;
}
