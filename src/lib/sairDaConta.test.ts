import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "next-auth/react";
import { encerrarVerComo } from "./plataforma";
import { sairDaConta } from "./sairDaConta";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("./plataforma", () => ({ encerrarVerComo: vi.fn() }));

const SESSAO = {
  id: "6f1c2a7e-0000-4000-8000-000000000001",
  usuario: { id: 7, nome: "Coordenação" },
  admin: { id: 1, nome: "Admin" },
  iniciada_em: "2026-10-19T15:00:00Z",
  expira_em: "2099-10-19T16:00:00Z",
};

beforeEach(() => {
  vi.mocked(signOut).mockReset().mockResolvedValue(undefined as never);
  vi.mocked(encerrarVerComo).mockReset().mockResolvedValue(undefined);
});

afterEach(() => sessionStorage.clear());

describe("sairDaConta (STC-790)", () => {
  it("em ver como: encerra no backend, tira da aba e desloga", async () => {
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));

    await sairDaConta();

    expect(encerrarVerComo).toHaveBeenCalledWith(SESSAO.id);
    expect(sessionStorage.getItem("atlas.verComo")).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });

  it("sem rede para encerrar: tira da aba e desloga mesmo assim", async () => {
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));
    vi.mocked(encerrarVerComo).mockRejectedValue(new Error("rede"));

    await sairDaConta();

    expect(sessionStorage.getItem("atlas.verComo")).toBeNull();
    expect(signOut).toHaveBeenCalled();
  });

  it("fora do ver como: só desloga", async () => {
    await sairDaConta();

    expect(encerrarVerComo).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
