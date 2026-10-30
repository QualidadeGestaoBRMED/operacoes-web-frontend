import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useColaboradorRH } from "@/hooks/useFeriasGestaoRH";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";

vi.mock("@/hooks/useFeriasGestaoRH", () => ({ useColaboradorRH: vi.fn() }));
vi.mock("./AbaAbsenteismo", () => ({ AbaAbsenteismo: () => <div>Aba de absenteísmo</div> }));
vi.mock("./AbaFerias", () => ({ AbaFerias: () => <div>Aba de férias</div> }));
vi.mock("./ConversaDoAlerta", () => ({ PainelConversa: () => null }));

const colaborador = {
  id: 7,
  nome: "Colaborador de Teste",
  cargo: "Técnico",
  equipe: "",
  unidade: { id: 1, nome: "Unidade Centro" },
  matricula_vr: "123",
  data_admissao: "2024-01-15",
  ativo: true,
  alertas_pendentes: { ferias: 0, absenteismo: 0 },
};

describe("DetalheColaboradorModal, fechamento (STC-960)", () => {
  it("fechar não troca os dados pelo carregamento durante a saída", async () => {
    vi.mocked(useColaboradorRH).mockImplementation(
      (id) =>
        ({
          colaborador: id === null ? undefined : colaborador,
          isLoading: false,
          mensagemErro: null,
          recarregar: vi.fn(),
        }) as unknown as ReturnType<typeof useColaboradorRH>,
    );
    const { rerender } = render(
      <DetalheColaboradorModal colaboradorId={7} periodoEmFoco={null} onFechar={vi.fn()} />,
    );
    expect(screen.getByText("Colaborador de Teste")).toBeInTheDocument();
    const textos: string[] = [];
    const observador = new MutationObserver((mudancas) => {
      for (const mudanca of mudancas) {
        mudanca.addedNodes.forEach((no) => textos.push(no.textContent ?? ""));
      }
    });
    observador.observe(document.body, { childList: true, subtree: true });

    rerender(<DetalheColaboradorModal colaboradorId={null} periodoEmFoco={null} onFechar={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    observador.disconnect();

    expect(textos.join("\n")).not.toContain("Carregando colaborador");
    // Depois da saída, para de buscar o colaborador.
    await waitFor(() => expect(vi.mocked(useColaboradorRH)).toHaveBeenLastCalledWith(null));
  });
});
