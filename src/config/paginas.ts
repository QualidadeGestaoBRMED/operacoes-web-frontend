// Título de cada tela pra Topbar exibir qual módulo está aberto -- sem isso,
// nada na tela avisava onde o usuário estava além do item destacado na
// sidebar (gap identificado comparando com o ProntuAI).
export interface PaginaConfig {
  prefixo: string;
  titulo: string;
}

export const PAGINAS: PaginaConfig[] = [
  { prefixo: "/modulos/gestao-demandas", titulo: "Gestão de Demandas" },
  { prefixo: "/modulos/legalizacao", titulo: "Legalização" },
  { prefixo: "/modulos/gestao-rh", titulo: "Gestão RH" },
];
