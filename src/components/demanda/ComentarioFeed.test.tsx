import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { Comentario, Usuario } from "@/types";
import { fonteDaDemanda } from "@/hooks/useComentarios";
import { ComentarioFeed } from "./ComentarioFeed";

vi.mock("@/lib/demandas");
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { listarComentarios } from "@/lib/demandas";

function autor(dados: Partial<Usuario>): Usuario {
  return {
    id: 1,
    username: "nathalya",
    email: "nathalya@grupobrmed.com.br",
    first_name: "Nathalya",
    last_name: "Almeida",
    perfil: null,
    unidade_id: null,
    setor_id: null,
    ativo: true,
    ultimo_acesso: null,
    foto_url: "",
    ...dados,
  };
}

function comentario(id: number, usuario: Usuario | null): Comentario {
  return { id, usuario, texto: `Comentário ${id}`, created_at: "2026-08-15T18:27:00Z" };
}

describe("ComentarioFeed (STC-795)", () => {
  it("foto do Google de quem comentou; sem foto ou conta removida, as iniciais", async () => {
    vi.mocked(listarComentarios).mockResolvedValue([
      comentario(1, autor({ id: 1, foto_url: "https://foto.exemplo/nathalya.jpg" })),
      comentario(2, autor({ id: 2, first_name: "Leonardo", last_name: "Lopes" })),
      comentario(3, null),
    ]);
    const { container } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ComentarioFeed fonte={fonteDaDemanda(9)} podeComentar={false} />
      </SWRConfig>,
    );

    await screen.findByText("Comentário 1");
    const fotos = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(fotos).toEqual(["https://foto.exemplo/nathalya.jpg"]);
    expect(screen.getByText("LL")).toBeInTheDocument();
    // Conta excluída: iniciais de "Usuário removido".
    expect(screen.getByText("UR")).toBeInTheDocument();
  });
});
