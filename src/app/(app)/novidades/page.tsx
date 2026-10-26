import ReactMarkdown from "react-markdown";
import { ListaDeNovidades } from "@/components/novidades/ListaDeNovidades";
import { lerNovidades } from "@/lib/conteudoNovidades";

/** Texto das Novidades, montado no servidor: o leitor de Markdown não vai
 * para o navegador. Sem HTML no conteúdo (o padrão do react-markdown). */
function Texto({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        p: (props) => <p className="leading-relaxed" {...props} />,
        ul: (props) => <ul className="list-disc space-y-1 pl-5" {...props} />,
        ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
        h3: (props) => <h3 className="pt-2 text-sm font-semibold text-foreground" {...props} />,
        a: (props) => <a className="font-medium text-primary hover:underline" {...props} />,
        strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

export default function NovidadesPage() {
  const novidades = lerNovidades().map(({ corpo, ...resumida }) => ({
    ...resumida,
    texto: corpo ? <Texto markdown={corpo} /> : null,
  }));
  return <ListaDeNovidades novidades={novidades} />;
}
