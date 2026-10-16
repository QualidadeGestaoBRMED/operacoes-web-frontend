import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { useAtualizarStatusDemanda } from "@/hooks/useDemandaMutations";
import { useUsuarios } from "@/hooks/useUsuarios";
import { criarDemanda } from "@/test-utils/fixtures";
import type { Rede } from "@/types";
import { TransicaoStatusSection } from "./TransicaoStatusSection";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useUsuarios", () => ({ useUsuarios: vi.fn() }));
vi.mock("@/hooks/useDemandaMutations", () => ({ useAtualizarStatusDemanda: vi.fn() }));

function comAdminDe(redes: Rede[]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { usuarioId: 1, redes_administradas: redes },
    isLoading: false,
  } as never);
}

function renderSecao(rede: Rede) {
  const demanda = criarDemanda({
    status: "concluido",
    unidade: { id: 1, nome: "Unidade", codigo: "UNI", cidade: "Rio", ativa: true, rede },
  });
  render(
    <TransicaoStatusSection
      demanda={demanda}
      podeEscrever
      ativo
      aoAbrir={vi.fn()}
      aoFechar={vi.fn()}
    />,
  );
}

async function opcoesDeStatus() {
  // Sem nenhuma transição permitida, a seção nem mostra o seletor.
  const seletor = screen.queryByRole("combobox", { name: "Novo status" });
  if (!seletor) return [];
  await userEvent.setup().click(seletor);
  return screen.queryAllByRole("option").map((opcao) => opcao.textContent);
}

beforeEach(() => {
  vi.mocked(useUsuarios).mockReturnValue({ usuarios: [], isLoading: false } as never);
  vi.mocked(useAtualizarStatusDemanda).mockReturnValue({
    atualizarStatus: vi.fn(),
    isLoading: false,
  } as never);
});

describe("TransicaoStatusSection -- transições de Admin pela rede da demanda (STC-747)", () => {
  it("Admin Operações reabre demanda concluída da rede padrão", async () => {
    comAdminDe(["padrao"]);
    renderSecao("padrao");

    expect(await opcoesDeStatus()).toContain("Backlog");
  });

  it("Admin Operações não reabre demanda de Operações Especiais", async () => {
    comAdminDe(["padrao"]);
    renderSecao("opex");

    expect(await opcoesDeStatus()).not.toContain("Backlog");
  });

  it("Gestão de Operações reabre nas duas redes", async () => {
    comAdminDe(["opex", "padrao"]);
    renderSecao("opex");

    expect(await opcoesDeStatus()).toContain("Backlog");
  });
});
