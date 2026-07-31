import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/modulos/gestao-demandas",
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";

describe("Sidebar -- bloco Admin Q&G (STC-262)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // vi.stubEnv não reverte sozinho (precisaria de unstubEnvs:true no
  // vitest.config.ts, que não está ligado) -- sem isso, o valor ficaria
  // vazando em process.env pra qualquer teste rodado depois deste, no
  // mesmo processo do Vitest.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não aparece pra quem não é Admin Q&G", () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: false } as ReturnType<typeof useAuth>);

    render(<Sidebar />);

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
  });

  it("aparece como link pro Django Admin pra quem é Admin Q&G", () => {
    // Achado escrevendo o teste: process.env.NEXT_PUBLIC_API_URL não é
    // populado pelo Vitest (só pelo build real do Next.js) -- sem
    // vi.stubEnv, os dois lados da comparação comparariam "undefined/admin"
    // contra "undefined/admin", um teste que passa sem provar nada.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo.test");
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: true } as ReturnType<typeof useAuth>);

    render(<Sidebar />);

    const link = screen.getByRole("link", { name: /admin q&g/i });
    expect(link).toHaveAttribute("href", "https://api.exemplo.test/admin");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
