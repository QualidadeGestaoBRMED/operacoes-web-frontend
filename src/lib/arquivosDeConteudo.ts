import fs from "node:fs";
import path from "node:path";
import { ehCaminhoInterno } from "./novidades";

/**
 * O que a leitura das Novidades (STC-877) e da Ajuda (STC-878) tem em comum:
 * um arquivo Markdown por entrada, com cabeçalho, lido só no servidor. As
 * pastas entram no pacote publicado pelo `outputFileTracingIncludes` do
 * next.config.
 */

/** Texto do cabeçalho, sem espaços nas pontas; vazio ou ausente: null. */
export function textoDoCabecalho(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Só caminhos do próprio Atlas ("/modulos/..."), nunca outro endereço. */
export function caminhoInterno(valor: unknown): string | null {
  const caminho = textoDoCabecalho(valor);
  return caminho && ehCaminhoInterno(caminho) ? caminho : null;
}

/**
 * Os arquivos `.md` da pasta (menos o LEIAME), cada um lido por `ler`.
 * Arquivo inválido fica de fora e vai para o log, sem derrubar o Atlas (o
 * teste do conteúdo pega antes do merge).
 */
export function lerPasta<T>(
  pasta: string,
  ler: (arquivo: string, conteudo: string) => T | string,
  /** Começo do aviso no log: "Novidade ignorada", "Artigo da Ajuda ignorado". */
  aviso: string,
): T[] {
  const arquivos = fs.existsSync(pasta)
    ? fs.readdirSync(pasta).filter((nome) => nome.endsWith(".md") && nome !== "LEIAME.md")
    : [];
  const validos: T[] = [];
  for (const arquivo of arquivos) {
    const lido = ler(arquivo, fs.readFileSync(path.join(pasta, arquivo), "utf-8"));
    if (typeof lido === "string") {
      console.error(`${aviso} (${arquivo}): ${lido}.`);
    } else {
      validos.push(lido);
    }
  }
  return validos;
}
