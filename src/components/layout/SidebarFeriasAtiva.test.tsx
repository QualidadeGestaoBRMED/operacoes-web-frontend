import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

// Férias religada (FERIAS_ATIVA): o submenu de Gestão RH volta a ter o
// Painel de Férias. Arquivo próprio porque a chave é lida quando
// modulos-futuros.ts carrega.
vi.mock("@/config/gestaoRH", () => ({ FERIAS_ATIVA: true }));
vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/plataforma");

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { listarModulos } from "@/lib/plataforma";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarModulos).mockResolvedValue([
    {
      id: 2,
      nome: "Gestão RH",
      codigo: "gestao-rh",
      descricao: "",
      status: "ativo",
      versao: "0.1.0",
      recursos_permissao: [],
    },
  ]);
});

describe("Sidebar -- Gestão RH com férias ligada (STC-728)", () => {
  it("coordenação vê os dois painéis; no de Férias, só ele fica ativo", async () => {
    vi.mocked(usePathname).mockReturnValue("/modulos/gestao-rh/ferias");
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as ReturnType<typeof useAuth>);
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Sidebar />
      </SWRConfig>,
    );

    const ferias = await screen.findByRole("link", { name: "Painel de Férias" });
    expect(ferias).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Painel de Absenteísmo" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.queryByRole("link", { name: "Parâmetros de Gestão RH" })).not.toBeInTheDocument();
  });
});
