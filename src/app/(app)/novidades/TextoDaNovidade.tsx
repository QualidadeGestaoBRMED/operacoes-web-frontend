import ReactMarkdown from "react-markdown";

/** Texto das Novidades, montado no servidor: o leitor de Markdown não vai
 * para o navegador. Sem HTML no conteúdo (o padrão do react-markdown). */
export function TextoDaNovidade({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        ul: (props) => <ul className="list-disc space-y-1.5 pl-5 marker:text-border" {...props} />,
        ol: (props) => <ol className="list-decimal space-y-1.5 pl-5" {...props} />,
        h3: (props) => <h3 className="pt-3 text-base font-semibold text-foreground" {...props} />,
        a: (props) => <a className="font-medium text-primary hover:underline" {...props} />,
        strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
