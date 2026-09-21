import { BookOpen, Building2, FileText, Gauge, type LucideIcon, Users } from "lucide-react";

// Fonte única do roadmap de módulos -- Sidebar e Hub (ModuleTileMutado)
// consomem esta mesma lista pra decidir o que mostrar bloqueado "em breve".
// Achado no review do Tech Lead: antes cada tela tinha sua própria cópia, e
// nada garantia que ficassem sincronizadas.
export interface ModuloFuturo {
  nome: string;
  icon: LucideIcon;
  descricao: string;
  larguras?: string[];
  // codigo/rota só existem pros módulos que já têm página construída no
  // frontend -- é o mapeamento "código → rota, ícone" que fica em código,
  // nunca vindo do backend. Sem os dois, o módulo fica bloqueado sempre,
  // não importa o que `Modulo.status` diga (ver useModulosNavegacao.ts) --
  // a checagem de "existe página construída" é decisão do frontend.
  codigo?: string;
  rota?: string;
  // STC-496: só Legalização tem hoje -- item de sidebar expansível, revela
  // as rotas abaixo em vez de um link único. Não é um mecanismo genérico
  // pra qualquer módulo ainda, só o que essa issue pediu; outro módulo que
  // precisar disso no futuro também ganha o campo, sem precisar de novo
  // tipo/abstração.
  subitens?: { label: string; rota: string }[];
}

export const MODULOS_FUTUROS: ModuloFuturo[] = [
  {
    nome: "Legalização",
    icon: FileText,
    descricao: "Documentos e conformidade por unidade.",
    codigo: "legalizacao",
    rota: "/modulos/legalizacao",
    subitens: [
      { label: "Matriz de Conformidade", rota: "/modulos/legalizacao" },
      { label: "Biblioteca de Documentos", rota: "/modulos/legalizacao/biblioteca" },
    ],
  },
  {
    nome: "Gestão RH",
    icon: Users,
    descricao: "Quadro de colaboradores por unidade.",
    larguras: ["60%"],
  },
  {
    nome: "Arquitetura",
    icon: Building2,
    descricao: "Projetos e obras em andamento nas unidades.",
  },
  {
    nome: "Diário de Bordo",
    icon: BookOpen,
    descricao: "Registro de ocorrências e passagens de plantão.",
    larguras: ["75%", "50%"],
  },
  {
    nome: "Calibração de Equipamentos",
    icon: Gauge,
    descricao: "Controle de calibração e manutenção preventiva.",
    larguras: ["65%", "40%"],
  },
];
