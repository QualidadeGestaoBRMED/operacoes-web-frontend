import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Unidade, Usuario } from "@/types";
import type {
  DocumentoUnidade,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { MatrizTable } from "./MatrizTable";

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};

const USUARIO: Usuario = {
  id: 10,
  username: "leg",
  email: "leg@grupobrmed.com.br",
  first_name: "Time",
  last_name: "Legalização",
  perfil: null,
  unidade_id: null,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
  foto_url: "",
};

function tipo(
  overrides: Partial<TipoDocumentoRegulatorio> = {},
): TipoDocumentoRegulatorio {
  return {
    id: 3,
    codigo: "alvara-funcionamento",
    nome: "Alvará de Funcionamento",
    categoria: "regularizacao",
    area_responsavel: "legalizacao",
    setor_apoio: "",
    exige_validade: true,
    exige_protocolo: false,
    exige_evidencia: true,
    controlado_por_profissional: false,
    permite_multiplas_instancias: false,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function documento(
  overrides: Partial<DocumentoUnidade> = {},
): DocumentoUnidade {
  return {
    id: 55,
    tipo_documento: tipo(),
    unidade: UNIDADE,
    status: "regular",
    justificativa_excecao: "",
    validade: "2026-12-01",
    evidencia_vigente: null,
    regra_aplicada: null,
    responsaveis: [
      {
        id: 1,
        usuario: USUARIO,
        principal: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    profissional: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderTabela(onClickLinha: (documento: DocumentoUnidade) => void) {
  return render(
    <table>
      <MatrizTable
        documentos={[documento()]}
        carregandoPrimeiraVez={false}
        ordenacao={null}
        onOrdenar={vi.fn()}
        refTabela={{ current: null }}
        maxHeight={undefined}
        onClickLinha={onClickLinha}
      />
    </table>,
  );
}

describe("MatrizTable (STC-380, acessibilidade da linha clicável)", () => {
  it("<tr> não sobrescreve o role implícito de linha (achado em code review)", () => {
    renderTabela(vi.fn());

    const linhas = screen.getAllByRole("row");
    // Cabeçalho + 1 linha de documento -- se a <tr> da linha tivesse
    // role="button", ela sumiria da lista de "row" (papel sobrescrito).
    expect(linhas).toHaveLength(2);
  });

  it("clicar no botão da célula Unidade abre o documento uma única vez", async () => {
    const onClickLinha = vi.fn();
    const user = userEvent.setup();
    renderTabela(onClickLinha);

    await user.click(screen.getByRole("button", { name: "Niterói" }));

    expect(onClickLinha).toHaveBeenCalledTimes(1);
    expect(onClickLinha).toHaveBeenCalledWith(documento());
  });

  it("clicar em qualquer outra célula da linha também abre o documento (clique de mouse na linha inteira)", async () => {
    const onClickLinha = vi.fn();
    const user = userEvent.setup();
    renderTabela(onClickLinha);

    await user.click(screen.getByText("Alvará de Funcionamento"));

    expect(onClickLinha).toHaveBeenCalledTimes(1);
  });

  it("o botão da célula Unidade é ativável por teclado (Enter)", async () => {
    const onClickLinha = vi.fn();
    const user = userEvent.setup();
    renderTabela(onClickLinha);

    const botao = screen.getByRole("button", { name: "Niterói" });
    botao.focus();
    expect(botao).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onClickLinha).toHaveBeenCalledTimes(1);
  });

  it("mostra o profissional junto ao tipo pra diferenciar linhas do mesmo tipo+unidade (STC-432)", () => {
    const tipoDosimetria = tipo({
      id: 9,
      codigo: "dosimetria",
      nome: "Dosimetria",
      controlado_por_profissional: true,
      permite_multiplas_instancias: false,
    });
    render(
      <table>
        <MatrizTable
          documentos={[
            documento({
              id: 1,
              tipo_documento: tipoDosimetria,
              profissional: "Dr. João",
            }),
            documento({
              id: 2,
              tipo_documento: tipoDosimetria,
              profissional: "Dra. Maria",
            }),
          ]}
          carregandoPrimeiraVez={false}
          ordenacao={null}
          onOrdenar={vi.fn()}
          refTabela={{ current: null }}
          maxHeight={undefined}
          onClickLinha={vi.fn()}
        />
      </table>,
    );

    expect(screen.getByText("Dosimetria — Dr. João")).toBeInTheDocument();
    expect(screen.getByText("Dosimetria — Dra. Maria")).toBeInTheDocument();
  });

  it("não mostra separador quando o documento não tem profissional (tipo comum)", () => {
    renderTabela(vi.fn());

    // getByText casa a string inteira do nó de texto -- se tivesse anexado
    // " — <profissional>" (documento() default tem profissional: ""), essa
    // busca exata não encontraria nada.
    expect(
      screen.getByText("Alvará de Funcionamento"),
    ).toBeInTheDocument();
  });
});

describe("MatrizTable, foto do Google do responsável (STC-795)", () => {
  function renderCom(usuario: Usuario) {
    return render(
      <table>
        <MatrizTable
          documentos={[documento({ responsaveis: [{ ...documento().responsaveis[0], usuario }] })]}
          carregandoPrimeiraVez={false}
          ordenacao={null}
          onOrdenar={vi.fn()}
          refTabela={{ current: null }}
          maxHeight={undefined}
          onClickLinha={vi.fn()}
        />
      </table>,
    );
  }

  it("com foto, a foto; sem foto, as iniciais", () => {
    const { container, unmount } = renderCom({ ...USUARIO, foto_url: "https://foto.exemplo/leg.jpg" });
    expect(container.querySelector("img")).toHaveAttribute("src", "https://foto.exemplo/leg.jpg");
    unmount();

    renderCom(USUARIO);
    expect(screen.getByText("TL")).toBeInTheDocument();
  });
});

