import { ClipboardList, type LucideIcon } from "lucide-react";

// Título e ícone de cada tela pra Topbar exibir qual módulo está aberto --
// sem isso, nada na tela avisava onde o usuário estava além do item
// destacado na sidebar (gap identificado comparando com o ProntuAI).
export interface PaginaConfig {
  prefixo: string;
  titulo: string;
  icon: LucideIcon;
}

export const PAGINAS: PaginaConfig[] = [
  { prefixo: "/modulos/gestao-demandas", titulo: "Gestão de Demandas", icon: ClipboardList },
];
