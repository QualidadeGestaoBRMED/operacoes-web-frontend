import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MODULOS_FUTUROS } from "@/config/modulos-futuros";
import { HubContent } from "./HubContent";

// STC-171: a rota /hub só redireciona pra /modulos/gestao-demandas (ver
// comentário em page.tsx) -- código morto de propósito, escondido nessa
// sessão. HubContent tem a UI real, sem props, com dados mockados
// internos -- testa o componente direto, não a rota.
describe("HubContent", () => {
  it("mostra as ocorrências que precisam de decisão", () => {
    render(<HubContent />);

    expect(screen.getByText("3 demandas sem responsável principal")).toBeInTheDocument();
    expect(screen.getByText("Manutenção elétrica atrasada há 4 dias")).toBeInTheDocument();
    expect(screen.getByText("Demanda aguardando aprovação em revisão")).toBeInTheDocument();
  });

  it("mostra o tile do módulo ativo (Gestão de Demandas)", () => {
    render(<HubContent />);

    expect(screen.getByText("Gestão de Demandas")).toBeInTheDocument();
    expect(screen.getByText("Carga operacional do mês")).toBeInTheDocument();
  });

  it("mostra um tile mutado por módulo futuro (mesma fonte usada pela Sidebar)", () => {
    render(<HubContent />);

    for (const modulo of MODULOS_FUTUROS) {
      expect(screen.getByText(modulo.nome)).toBeInTheDocument();
    }
  });
});
