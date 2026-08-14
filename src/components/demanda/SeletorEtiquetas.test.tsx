import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeletorEtiquetas } from "./SeletorEtiquetas";

vi.mock("@/lib/demandas");
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAdminOps: true }),
}));

import { listarEtiquetas } from "@/lib/demandas";

function renderSeletor(modulo: number | undefined) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SeletorEtiquetas value={[]} onChange={vi.fn()} modulo={modulo} />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarEtiquetas).mockResolvedValue([]);
});

describe("SeletorEtiquetas -- gatilho 'Etiqueta' sem módulo resolvido", () => {
  it("desabilita o gatilho quando modulo ainda não foi selecionado", () => {
    renderSeletor(undefined);

    const gatilho = screen.getByRole("button", { name: /etiqueta/i });
    expect(gatilho).toBeDisabled();
    expect(gatilho).toHaveAttribute("title", "Selecione o tipo de gestão primeiro.");
  });

  it("habilita o gatilho assim que modulo é resolvido", () => {
    renderSeletor(1);

    const gatilho = screen.getByRole("button", { name: /etiqueta/i });
    expect(gatilho).not.toBeDisabled();
    expect(gatilho).not.toHaveAttribute("title");
  });
});
