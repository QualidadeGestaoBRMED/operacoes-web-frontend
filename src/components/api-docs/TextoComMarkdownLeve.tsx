import { Fragment } from "react";

// O schema (drf-spectacular) usa 2 convenções leves de Markdown que a
// página até agora renderizava como texto puro: `código` inline (crases)
// em prosa, e lista de choices "* `valor` - Rótulo" separadas por \n
// (gerada automaticamente pra campo enum, ex. status de documento). Não é
// um parser de Markdown completo -- só o suficiente pras 2 formas reais
// observadas no schema real.
function ComCodigoInline({ texto }: { texto: string }) {
  const partes = texto.split(/(`[^`]+`)/g).filter((parte) => parte !== "");
  return (
    <>
      {partes.map((parte, indice) =>
        parte.startsWith("`") && parte.endsWith("`") ? (
          <code
            key={indice}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground"
          >
            {parte.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={indice}>{parte}</Fragment>
        ),
      )}
    </>
  );
}

export function TextoComMarkdownLeve({ texto }: { texto: string | undefined }) {
  if (!texto) return null;
  const linhas = texto.split("\n").filter((linha) => linha.trim() !== "");
  const ehLista =
    linhas.length > 0 && linhas.every((linha) => /^\*\s+/.test(linha.trim()));

  if (ehLista) {
    return (
      <ul className="list-disc space-y-1 pl-4">
        {linhas.map((linha, indice) => (
          <li key={indice}>
            <ComCodigoInline texto={linha.trim().replace(/^\*\s+/, "")} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {linhas.map((linha, indice) => (
        <Fragment key={indice}>
          {indice > 0 && <br />}
          <ComCodigoInline texto={linha} />
        </Fragment>
      ))}
    </>
  );
}
