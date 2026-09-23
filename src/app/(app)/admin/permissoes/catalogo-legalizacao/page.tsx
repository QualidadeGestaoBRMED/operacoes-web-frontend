import { PermissoesAdmin } from "@/components/admin/PermissoesAdmin";

// STC-519 (achado em revisão de falhas críticas): rota própria em vez de
// ?aba=catalogo-legalizacao na mesma /admin/permissoes -- a 1ª tentativa
// (query string) tinha dois problemas de raiz, os dois vindos do mesmo
// lugar (duas entradas de sidebar pro mesmo pathname, sem nada
// distinguindo entre elas): (1) o submenu de Legalização destacava
// "Catálogo de Legalização" como ativo mesmo com "Administração" aberto
// (pathname.startsWith() não olha querystring); (2) sem reload, trocar de
// um link pro outro reaproveitava a mesma instância de PermissoesAdmin,
// então a aba ficava presa no valor anterior. Uma rota de verdade resolve
// os dois: pathname distingue as duas entradas sozinho (sem precisar de
// useSearchParams()/Suspense em nada global como o Sidebar), e o Next.js
// remonta a árvore ao navegar entre rotas de app diferentes -- sem estado
// preso entre uma e outra.
export default function CatalogoLegalizacaoAdminPage() {
  return <PermissoesAdmin abaInicial="catalogo-legalizacao" />;
}
