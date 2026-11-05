import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RegistroHistoricoRH } from "@/types/gestaoRH";
import { HistoricoRH } from "./HistoricoRH";

const automatico = { por: null, automatico: true, em: "2026-11-12T01:00:00Z", periodo: null };

describe("HistoricoRH -- desligamento automático (STC-988)", () => {
  it("mostra o desligamento e a reativação pela Jornada, com a justificativa e como automáticos", () => {
    const registros: RegistroHistoricoRH[] = [
      {
        ...automatico,
        acao: "colaborador_reativado_automaticamente",
        valor_anterior: "Desligado",
        valor_novo: "Ativo",
        justificativa: "Jornada no VR de novo em 20/11/2026",
        regra_gatilho: "sem_jornada_no_vr",
      },
      {
        ...automatico,
        acao: "alerta_absenteismo_encerrado",
        valor_anterior: "Crítica",
        valor_novo: "",
        justificativa: "Colaborador desligado; alerta de 01/10/2026 a 31/10/2026 sem tratamento",
        regra_gatilho: "desligamento",
      },
      {
        ...automatico,
        acao: "colaborador_desligado_automaticamente",
        valor_anterior: "Ativo",
        valor_novo: "Desligado",
        justificativa: "Sem jornada no VR desde 28/10/2026",
        regra_gatilho: "sem_jornada_no_vr",
      },
    ];
    render(<HistoricoRH id="historico" registros={registros} />);

    const itens = screen.getAllByRole("listitem");
    expect(itens[0]).toHaveTextContent("Reativado automaticamente");
    expect(itens[0]).toHaveTextContent("“Jornada no VR de novo em 20/11/2026”");
    expect(itens[1]).toHaveTextContent("Alerta encerrado: colaborador desligado");
    expect(itens[2]).toHaveTextContent("Desligado automaticamente");
    expect(itens[2]).toHaveTextContent("“Sem jornada no VR desde 28/10/2026”");
    for (const item of itens) expect(item).toHaveTextContent("automático");
  });
});
