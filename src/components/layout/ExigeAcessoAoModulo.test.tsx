import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExigeAcessoAoModulo } from "./ExigeAcessoAoModulo";

const estado = vi.hoisted(() => ({
  carregando: false,
  acessos: {} as Record<string, boolean>,
  modulos: [] as { codigo: string; rota: string }[],
}));
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/hooks/useModulosNavegacao", () => ({
  useAcessoAosModulos: () => ({
    carregando: estado.carregando,
    temAcesso: (codigo: string) => estado.acessos[codigo] !== false,
  }),
}));
vi.mock("@/hooks/useNavegacao", () => ({ useNavegacao: () => ({ modulos: estado.modulos }) }));

function abrir() {
  render(
    <ExigeAcessoAoModulo codigo="legalizacao">
      <p>tela da Legalização</p>
    </ExigeAcessoAoModulo>,
  );
}

beforeEach(() => {
  replace.mockReset();
  estado.carregando = false;
  estado.acessos = {};
  estado.modulos = [{ codigo: "gestao-demandas", rota: "/modulos/gestao-demandas" }];
});

describe("ExigeAcessoAoModulo (STC-973)", () => {
  it("com acesso, a tela do módulo", () => {
    abrir();
    expect(screen.getByText("tela da Legalização")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("enquanto a lista carrega, nem a tela nem o redirecionamento", () => {
    estado.carregando = true;
    estado.acessos = { legalizacao: false };
    abrir();
    expect(screen.queryByText("tela da Legalização")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sem acesso, vai para o primeiro módulo liberado, sem mostrar a tela", () => {
    estado.acessos = { legalizacao: false };
    abrir();
    expect(screen.queryByText("tela da Legalização")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/modulos/gestao-demandas");
  });

  it("sem acesso a módulo nenhum, aviso no lugar, sem redirecionar", () => {
    estado.acessos = { legalizacao: false };
    estado.modulos = [];
    abrir();
    expect(screen.getByText(/ainda não tem acesso a nenhum módulo/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
