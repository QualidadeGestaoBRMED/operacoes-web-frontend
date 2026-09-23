import { PermissoesAdmin } from "@/components/admin/PermissoesAdmin";

// STC-519 (achado em revisão de falhas críticas, 2ª rodada): PermissoesAdmin
// vive AQUI (não em cada page.tsx) de propósito -- um layout.tsx persiste
// entre navegações para rotas filhas (esta e catalogo-legalizacao/), nunca
// remonta. Com o componente vivendo em cada page.tsx (tentativa anterior),
// trocar de aba pelo Select "Seção" (que navega entre as duas rotas pra
// manter a sidebar sincronizada) desmontava e remontava tudo, perdendo
// filtros/seção expandida/diálogos abertos. As duas page.tsx deste
// diretório não renderizam nada (o layout já cobre tudo) -- existem só
// pra Next.js reconhecer as rotas.
export default function PermissoesLayout() {
  return <PermissoesAdmin />;
}
