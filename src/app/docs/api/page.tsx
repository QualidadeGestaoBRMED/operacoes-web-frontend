import { ApiDocs } from "@/components/api-docs/ApiDocs";
import { CabecalhoApiDocs } from "@/components/api-docs/CabecalhoApiDocs";

// Página standalone, fora do grupo (app) de propósito -- sem o AppShell
// (sidebar+topbar do app principal), então precisa da própria altura de
// tela cheia aqui (o AppShell normalmente é quem dava essa altura pro
// conteúdo via seu <main> flex-1).
export default function ApiDocsPage() {
  return (
    <div className="flex h-screen flex-col">
      <CabecalhoApiDocs />
      <div className="min-h-0 flex-1">
        <ApiDocs />
      </div>
    </div>
  );
}
