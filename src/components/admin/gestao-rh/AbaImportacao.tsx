import { Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Os relatórios que a operação exporta hoje do VR Pontomais, em XLS, um
// centro de custo por vez (semanal de 30/09/2026): cada relatório aceita
// vários arquivos. A lista definitiva depende da fonte dos dados (planilha,
// RPA ou API) e é ajustada quando a aba for ligada à API (STC-595).
const RELATORIOS = ["Espelho de ponto", "Pendências"];

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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="imp-inicio">Início do período *</Label>
            <Input id="imp-inicio" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-fim">Fim do período *</Label>
            <Input id="imp-fim" type="date" />
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {RELATORIOS.map((relatorio) => (
            <li
              key={relatorio}
              className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-3 py-3"
            >
              <span className="text-sm font-medium text-foreground">{relatorio}</span>
              <span className="text-xs text-muted-foreground">
                Arraste os arquivos XLS, um por centro de custo
              </span>
              <Button type="button" variant="outline" size="sm" className="mt-auto w-full">
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

      <div className="scrollbar-discreta overflow-x-auto rounded-lg border border-border">
        <table aria-label="Importações" className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {COLUNAS_HISTORICO.map((coluna) => (
                <th key={coluna} scope="col" className="px-4 py-2.5">
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={COLUNAS_HISTORICO.length} className="px-4 py-6 text-center text-muted-foreground">
                Nenhuma importação ainda.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
