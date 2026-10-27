import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { textoDoArtigo } from "@/app/(app)/ajuda/textoDoArtigo";
import type { ArtigoResumido } from "@/lib/ajuda";
import { PainelDeAjuda } from "./PainelDeAjuda";

vi.mock("@/app/(app)/ajuda/textoDoArtigo", () => ({ textoDoArtigo: vi.fn() }));

const MAPA: ArtigoResumido = {
  slug: "mapa",
  titulo: "Como ler o Mapa",
  resumo: "As cores.",
  modulo: "legalizacao",
  admin: false,
  telas: [],
  ordem: 1,
  popular: false,
};

describe("PainelDeAjuda (STC-878)", () => {
  it("falha ao carregar o texto: avisa e deixa tentar de novo", async () => {
    vi.mocked(textoDoArtigo).mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(<p>As cores do Mapa</p>);
    render(<PainelDeAjuda artigos={[MAPA]} nomeDoModulo="Legalização" aberto onOpenChange={() => {}} />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("As cores do Mapa")).toBeInTheDocument();
  });

  it("carrega o texto uma vez só, mesmo reaberto", async () => {
    vi.mocked(textoDoArtigo).mockReset().mockResolvedValue(<p>As cores do Mapa</p>);
    const { rerender } = render(
      <PainelDeAjuda artigos={[MAPA]} nomeDoModulo={null} aberto onOpenChange={() => {}} />,
    );
    await screen.findByText("As cores do Mapa");
    rerender(<PainelDeAjuda artigos={[MAPA]} nomeDoModulo={null} aberto={false} onOpenChange={() => {}} />);
    rerender(<PainelDeAjuda artigos={[MAPA]} nomeDoModulo={null} aberto onOpenChange={() => {}} />);

    expect(await screen.findByText("As cores do Mapa")).toBeInTheDocument();
    expect(textoDoArtigo).toHaveBeenCalledTimes(1);
  });
});
