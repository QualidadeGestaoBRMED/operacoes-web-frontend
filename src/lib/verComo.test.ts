import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type SessaoVerComo,
  guardarVerComo,
  lerAvisoDeFim,
  limparVerComo,
  sairDoVerComo,
  sessaoVerComo,
} from "./verComo";

function sessao(expiraEmMs: number): SessaoVerComo {
  return {
    id: "6f1c2a7e-0000-4000-8000-000000000001",
    usuario: { id: 7, nome: "Coordenação Niterói" },
    admin: { id: 1, nome: "Felipe" },
    iniciada_em: new Date().toISOString(),
    expira_em: new Date(Date.now() + expiraEmMs).toISOString(),
  };
}

afterEach(() => {
  limparVerComo();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("verComo (STC-790)", () => {
  it("guarda e lê a sessão desta aba", () => {
    expect(sessaoVerComo()).toBeNull();
    guardarVerComo(sessao(60_000));
    expect(sessaoVerComo()?.usuario.nome).toBe("Coordenação Niterói");
  });

  it("sessão vencida some ao ser lida", () => {
    guardarVerComo(sessao(-1));
    expect(sessaoVerComo()).toBeNull();
    expect(sessionStorage.getItem("atlas.verComo")).toBeNull();
  });

  it("conteúdo estragado no armazenamento vale como nenhuma sessão", () => {
    sessionStorage.setItem("atlas.verComo", "{nao e json");
    expect(sessaoVerComo()).toBeNull();
  });

  it("sair limpa a sessão, deixa o aviso para a próxima tela e navega", () => {
    const navegar = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: navegar });
    guardarVerComo(sessao(60_000));

    sairDoVerComo("/admin/permissoes", "O ver como terminou.");

    expect(sessaoVerComo()).toBeNull();
    expect(navegar).toHaveBeenCalledWith("/admin/permissoes");
    expect(lerAvisoDeFim()).toBe("O ver como terminou.");
    // O aviso aparece uma vez só.
    expect(lerAvisoDeFim()).toBeNull();
  });
});
