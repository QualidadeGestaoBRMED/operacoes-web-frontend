import { BookOpen, Building2, FileText, Gauge, type LucideIcon, Users } from "lucide-react";

// Fonte única do roadmap de módulos ainda não construídos -- Sidebar (item
// bloqueado "em breve") e a Hub (ModuleTileMutado) consomem esta mesma
// lista. Achado no review do Tech Lead: antes cada tela tinha sua própria
// cópia, e nada garantia que ficassem sincronizadas.
export interface ModuloFuturo {
  nome: string;
  icon: LucideIcon;
  descricao: string;
  larguras?: string[];
}

export const MODULOS_FUTUROS: ModuloFuturo[] = [
  { nome: "Legalização", icon: FileText, descricao: "Documentos e conformidade por unidade." },
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
