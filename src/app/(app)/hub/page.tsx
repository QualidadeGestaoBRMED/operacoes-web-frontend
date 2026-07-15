import { redirect } from "next/navigation";

// Achado no review do Tech Lead: esconder o link na Sidebar não impedia
// acesso via URL direta (/hub continuava renderizando dado mockado pra
// qualquer autenticado). Bloqueado de vez aqui. Conteúdo real preservado
// em HubContent.tsx -- reativar: trocar este redirect por
// `export { HubContent as default } from "./HubContent"`.
export default function HubPage() {
  redirect("/modulos/gestao-demandas");
}
