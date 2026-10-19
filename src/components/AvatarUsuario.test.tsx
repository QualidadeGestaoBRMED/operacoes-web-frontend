import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvatarUsuario } from "./AvatarUsuario";

describe("AvatarUsuario", () => {
  it("com foto: a foto do Google, sem Referer (o Google recusa servir com ele)", () => {
    const { container } = render(<AvatarUsuario imagem="https://foto.exemplo/a.jpg" iniciais="AN" />);

    const foto = container.querySelector("img");
    expect(foto).toHaveAttribute("src", "https://foto.exemplo/a.jpg");
    expect(foto).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.queryByText("AN")).not.toBeInTheDocument();
  });

  it("sem foto (vazia ou nula): as iniciais", () => {
    const { rerender, container } = render(<AvatarUsuario imagem="" iniciais="AN" />);
    expect(screen.getByText("AN")).toBeInTheDocument();
    rerender(<AvatarUsuario imagem={null} iniciais="AN" />);
    expect(screen.getByText("AN")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("foto que não carrega: volta para as iniciais", () => {
    const { container } = render(<AvatarUsuario imagem="https://foto.exemplo/quebrada.jpg" iniciais="AN" />);

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AN")).toBeInTheDocument();
  });
});
