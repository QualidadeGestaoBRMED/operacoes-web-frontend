// STC-519: conteúdo real fica em layout.tsx (../layout.tsx, ver comentário
// lá) -- esta página existe só pra Next.js reconhecer a rota
// /admin/permissoes/catalogo-legalizacao. PermissoesAdmin lê o pathname
// direto (usePathname()) pra saber que está aqui, não um prop desta página.
export default function CatalogoLegalizacaoAdminPage() {
  return null;
}
