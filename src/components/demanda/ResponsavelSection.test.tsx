import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarDemanda, responsavelPrincipal } from "@/test-utils/fixtures";
import type { Usuario } from "@/types";
import { ResponsavelSection } from "./ResponsavelSection";

// Auto-mock: mesma estratégia de KanbanBoard.test.tsx/FormNovaDemanda.test.tsx.
vi.mock("@/lib/demandas");
vi.mock("@/lib/plataforma");
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import {
  adicionarResponsavel,
  removerResponsavel,
  trocarPrincipalResponsavel,
} from "@/lib/demandas";
import { listarUsuarios } from "@/lib/plataforma";

const NOVO_PRINCIPAL: Usuario = {
  id: 3,
  username: "novo",
  email: "novo@grupobrmed.com.br",
  first_name: "Novo",
  last_name: "Principal",
  perfil: null,
  unidade_id: 1,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
};

function renderSecao() {
  const demanda = criarDemanda({ responsaveis: [responsavelPrincipal()] });
  const aoAbrir = vi.fn();
  const aoFechar = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ResponsavelSection
        demanda={demanda}
        podeEscrever
        ativo
        aoAbrir={aoAbrir}
        aoFechar={aoFechar}
      />
    </SWRConfig>,
  );
  return { demanda, aoAbrir, aoFechar };
}

async function abrirFormularioDeTroca(user: ReturnType<typeof userEvent.setup>) {
  // Único responsável é principal -- ehUnicoPrincipal() troca o botão de
  // remover pelo de "Trocar" (mesmo achado documentado no componente).
  await user.click(screen.getByRole("button", { name: /trocar/i }));
  await user.click(screen.getByLabelText(/usuário responsável/i));
  await user.click(await screen.findByRole("option", { name: "Novo Principal" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUsuarios).mockResolvedValue([NOVO_PRINCIPAL]);
});

describe("ResponsavelSection -- troca de principal (STC-230/STC-231)", () => {
  it("faz a troca com uma única chamada atômica, não mais adicionar+remover separados", async () => {
    vi.mocked(trocarPrincipalResponsavel).mockResolvedValue([]);
    const user = userEvent.setup();
    const { aoFechar } = renderSecao();

    await abrirFormularioDeTroca(user);
    await user.click(screen.getByRole("button", { name: "Confirmar troca" }));

    await waitFor(() => {
      expect(trocarPrincipalResponsavel).toHaveBeenCalledWith(
        expect.any(Number),
        responsavelPrincipal().usuario.id,
        NOVO_PRINCIPAL.id,
      );
    });
    // Antes, aoTrocarPrincipal chamava adicionar()/remover() em sequência --
    // o rewire pra trocarPrincipal() elimina os dois passos independentes
    // que podiam deixar a troca pela metade se o segundo falhasse.
    expect(adicionarResponsavel).not.toHaveBeenCalled();
    expect(removerResponsavel).not.toHaveBeenCalled();
    expect(aoFechar).toHaveBeenCalled();
  });

  it("mostra erro e não fecha o formulário quando a troca falha", async () => {
    vi.mocked(trocarPrincipalResponsavel).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    const { aoFechar } = renderSecao();

    await abrirFormularioDeTroca(user);
    await user.click(screen.getByRole("button", { name: "Confirmar troca" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(aoFechar).not.toHaveBeenCalled();
  });
});
