import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MODULOS = [
  {
    codigo: "gestao-demandas",
    nome: "Gestão de Demandas",
    descricao: "Acompanhamento de demandas operacionais em quadro Kanban.",
    href: "/modulos/gestao-demandas",
    ativo: true,
  },
  { codigo: "legalizacao", nome: "Legalização", descricao: "Em breve.", ativo: false },
  { codigo: "gestao-rh", nome: "Gestão RH", descricao: "Em breve.", ativo: false },
  { codigo: "manutencao", nome: "Manutenção", descricao: "Em breve.", ativo: false },
  { codigo: "indicadores", nome: "Indicadores", descricao: "Em breve.", ativo: false },
];

export default function HubPage() {
  return (
    <div className="p-6 md:p-8 lg:p-12">
      <h1 className="text-2xl font-semibold text-foreground">Hub de Operações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Selecione um módulo para continuar.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((modulo) => {
          const conteudo = (
            <Card
              className={!modulo.ativo ? "opacity-60" : "transition-colors hover:border-primary"}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{modulo.nome}</CardTitle>
                  {!modulo.ativo && <Badge variant="secondary">Em breve</Badge>}
                </div>
                <CardDescription>{modulo.descricao}</CardDescription>
              </CardHeader>
            </Card>
          );

          return modulo.ativo && modulo.href ? (
            <Link key={modulo.codigo} href={modulo.href}>
              {conteudo}
            </Link>
          ) : (
            <div key={modulo.codigo}>{conteudo}</div>
          );
        })}
      </div>
    </div>
  );
}
