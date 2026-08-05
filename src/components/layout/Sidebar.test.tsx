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

describe("Sidebar -- bloco Admin Q&G/Admin Operações (STC-262/STC-266)", () => {
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

  it("não aparece nada pra quem não é admin", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
    } as ReturnType<typeof useAuth>);

    render(<Sidebar />);

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin Operações")).not.toBeInTheDocument();
  });

  // Achado no code review do Tech Lead: NEXT_PUBLIC_API_URL é inlined em
  // build time -- ausente/vazia nesse build, o link viraria "undefined/admin"
  // até o próximo deploy. vi.stubEnv com string vazia simula esse cenário
  // (o valor "não populado" real do Vitest, undefined, já está coberto
  // implicitamente por todo teste que não chama stubEnv). O link interno
  // (STC-266) não depende dessa env, então continua aparecendo.
  it("não mostra o link do Django Admin se NEXT_PUBLIC_API_URL estiver ausente, mesmo pra Admin Q&G", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: true,
      isAdminOps: true,
    } as ReturnType<typeof useAuth>);

    render(<Sidebar />);

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
    expect(screen.getByText("Administração")).toBeInTheDocument();
  });

  it("Admin Q&G vê os dois links: Django Admin e a tela interna", () => {
    // Achado escrevendo o teste: process.env.NEXT_PUBLIC_API_URL não é
    // populado pelo Vitest (só pelo build real do Next.js) -- sem
    // vi.stubEnv, os dois lados da comparação comparariam "undefined/admin"
    // contra "undefined/admin", um teste que passa sem provar nada.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo.test");
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: true,
      isAdminOps: true,
    } as ReturnType<typeof useAuth>);

    render(<Sidebar />);

    const linkDjango = screen.getByRole("link", { name: /admin q&g/i });
    expect(linkDjango).toHaveAttribute("href", "https://api.exemplo.test/admin");
    expect(linkDjango).toHaveAttribute("target", "_blank");
    expect(linkDjango).toHaveAttribute("rel", "noopener noreferrer");

    const linkInterno = screen.getByRole("link", { name: /administração/i });
    expect(linkInterno).toHaveAttribute("href", "/admin/permissoes");
  });

  // STC-266: Admin Operações (nível 2, não Q&G) não tem login no Django
  // Admin configurado -- só vê a tela interna, rotulada com o próprio
  // perfil em vez de "Administração" genérico.
  it("Admin Operações (não Q&G) vê só o link interno, rotulado como 'Admin Operações'", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: true,
    } as ReturnType<typeof useAuth>);

    render(<Sidebar />);

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /admin operações/i });
    expect(link).toHaveAttribute("href", "/admin/permissoes");
  });
});
