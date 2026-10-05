import { Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Os 5 relatórios do mockup. A lista real depende da fonte dos dados
// (planilha, RPA ou API): ajustada quando a aba for ligada à API (STC-595).
const RELATORIOS = ["Jornada", "Faltas", "Pendências", "Afastamentos e férias", "Colaboradores"];

const COLUNAS_HISTORICO = [
  "Importado em",
  "Período",
  "Relatórios",
  "Linhas processadas",
  "Linhas rejeitadas",
  "Situação",
];

/**
 * Formulário de importação pronto e desligado: as rotas de importação ainda
 * não existem, porque dependem da definição da fonte dos dados de ponto.
 * Nenhuma chamada à API sai daqui.
 */
export function AbaImportacao() {
  return (
    <section aria-labelledby="titulo-importacao" className="space-y-5">
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-secondary" />
        <p>A importação será ativada quando a fonte dos dados for definida.</p>
      </div>

      <div className="space-y-1">
        <h2 id="titulo-importacao" className="text-base font-semibold text-foreground">
          Importação de planilhas do VR Pontomais
        </h2>
        <p className="text-sm text-muted-foreground">
          Exporte os relatórios do período no Pontomais e envie aqui. Os arquivos são processados e
          não ficam armazenados.
        </p>
      </div>

      <fieldset disabled className="space-y-5 disabled:opacity-60">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="imp-inicio">Início do período *</Label>
            <Input id="imp-inicio" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-fim">Fim do período *</Label>
            <Input id="imp-fim" type="date" />
          </div>
        </div>

        <ul className="divide-y divide-border rounded-md border border-border">
          {RELATORIOS.map((relatorio) => (
            <li key={relatorio} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-40 flex-1 text-sm font-medium text-foreground">{relatorio}</span>
              <span className="text-xs text-muted-foreground">Arraste o arquivo XLSX ou CSV</span>
              <Button type="button" variant="outline" size="sm">
                <Upload className="size-3.5" />
                Selecionar
              </Button>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Reimportar um período substitui os dados daquele período. CID, dados do médico e
          observações livres são descartados na importação.
        </p>

        <div className="flex justify-end">
          <Button type="button">Importar relatórios</Button>
        </div>
      </fieldset>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              {COLUNAS_HISTORICO.map((coluna) => (
                <th key={coluna} scope="col" className="px-3 py-2 font-medium">
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={COLUNAS_HISTORICO.length} className="px-3 py-6 text-center text-muted-foreground">
                Nenhuma importação ainda.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
