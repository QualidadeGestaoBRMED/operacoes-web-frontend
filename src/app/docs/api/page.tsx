import { ApiDocs } from "@/components/api-docs/ApiDocs";
import { CabecalhoApiDocs } from "@/components/api-docs/CabecalhoApiDocs";

// Página standalone, fora do grupo (app) de propósito -- sem o AppShell
// (sidebar+topbar do app principal), então precisa da própria altura de
// tela cheia aqui (o AppShell normalmente é quem dava essa altura pro
// conteúdo via seu <main> flex-1).
export default function ApiDocsPage() {
  return (
    // h-svh (não h-dvh): mesmo achado do AppShell.tsx (STC-505) -- svh evita
    // o corte do 100vh sem reintroduzir o travamento de scroll que dvh causa
    // (recalcula em tempo real durante o gesto).
    <div className="flex h-svh flex-col">
      <CabecalhoApiDocs />
      <div className="min-h-0 flex-1">
        <ApiDocs />
      </div>
    </div>
  );
}
