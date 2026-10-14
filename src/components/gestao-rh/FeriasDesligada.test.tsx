import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { CabecalhoColaborador } from "@/types/gestaoRH";

// Chave de férias como em produção nesta fase: desligada (STC-687).
vi.mock("@/config/gestaoRH", () => ({ FERIAS_ATIVA: false }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/gestaoRHFerias", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHFerias")>()),
  buscarColaboradorRH: vi.fn(),
  buscarFeriasColaborador: vi.fn(),
}));
vi.mock("@/lib/gestaoRHAbsenteismo", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHAbsenteismo")>()),
  buscarAbsenteismoColaborador: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/lib/gestaoRH", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRH")>()),
  buscarParametrosAbsenteismo: vi.fn(() => new Promise(() => {})),
  buscarReguaFerias: vi.fn(),
}));

import { redirect } from "next/navigation";
import PainelFeriasPage from "@/app/(app)/modulos/gestao-rh/ferias/page";
import { ParametrosGestaoRHAdmin } from "@/components/admin/gestao-rh/ParametrosGestaoRHAdmin";
import { MODULOS_FUTUROS } from "@/config/modulos-futuros";
import { buscarReguaFerias } from "@/lib/gestaoRH";
import { buscarAbsenteismoColaborador } from "@/lib/gestaoRHAbsenteismo";
import { buscarColaboradorRH, buscarFeriasColaborador } from "@/lib/gestaoRHFerias";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";

const COLABORADOR: CabecalhoColaborador = {
  id: 8,
  nome: "Juliana Ramos",
  matricula_vr: "004512",
  cargo: "Técnica de Enfermagem",
  unidade: { id: 1, nome: "Niterói" },
  data_admissao: "2024-03-12",
  ativo: true,
  alertas_pendentes: { ferias: 3, absenteismo: 1 },
};

describe("Gestão RH com férias desligada", () => {
  it("menu: Gestão RH só com o Painel de Absenteísmo, sem o Painel de Férias", () => {
    const gestaoRH = MODULOS_FUTUROS.find((modulo) => modulo.codigo === "gestao-rh");
    expect(gestaoRH?.subitens).toEqual([
      { label: "Painel de Absenteísmo", rota: "/modulos/gestao-rh" },
    ]);
    expect(gestaoRH?.rota).toBe("/modulos/gestao-rh");
    expect(gestaoRH?.descricao).toBe("Absenteísmo por colaborador.");
  });

  it("rota de férias leva ao Painel de Absenteísmo, mantendo o colaborador do link", async () => {
    await PainelFeriasPage({ searchParams: Promise.resolve({ colaborador: "8" }) });
    expect(redirect).toHaveBeenLastCalledWith("/modulos/gestao-rh?colaborador=8");

    await PainelFeriasPage({ searchParams: Promise.resolve({}) });
    expect(redirect).toHaveBeenLastCalledWith("/modulos/gestao-rh");
  });

  it("modal: só o absenteísmo, sem abas, mesmo quando o link pede a aba Férias", async () => {
    vi.mocked(buscarColaboradorRH).mockResolvedValue(COLABORADOR);
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <DetalheColaboradorModal
          colaboradorId={8}
          periodoEmFoco={12}
          abaInicial="ferias"
          onFechar={vi.fn()}
        />
      </SWRConfig>,
    );

    expect(await screen.findByRole("heading", { name: "Juliana Ramos" })).toBeInTheDocument();
    await waitFor(() => expect(buscarAbsenteismoColaborador).toHaveBeenCalled());
    expect(vi.mocked(buscarAbsenteismoColaborador).mock.calls[0][0]).toBe(8);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText(/Férias/)).not.toBeInTheDocument();
    expect(buscarFeriasColaborador).not.toHaveBeenCalled();
  });

  it("Parâmetros: aba Absenteísmo, sem a régua de férias", () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ParametrosGestaoRHAdmin />
      </SWRConfig>,
    );

    expect(screen.getByRole("tab", { name: "Absenteísmo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText(/Régua de alertas de férias/)).not.toBeInTheDocument();
    expect(buscarReguaFerias).not.toHaveBeenCalled();
  });
});
