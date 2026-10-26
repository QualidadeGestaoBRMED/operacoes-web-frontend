import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link2 } from "lucide-react";
import { MidiaDaNovidade } from "@/components/novidades/EntradaDaNovidade";
import { ehCaminhoInterno } from "@/lib/novidades";

interface No {
  type: string;
  value?: string;
  tagName?: string;
  children?: No[];
}

function textoDoNo(no: No | undefined): string {
  if (!no) return "";
  if (no.type === "text") return no.value ?? "";
  return (no.children ?? []).map(textoDoNo).join("");
}

/** "Horas por unidade" → "horas-por-unidade". */
export function ancora(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Texto de uma novidade, montado no servidor (o leitor de Markdown não vai
 * para o navegador; sem HTML no conteúdo, o padrão do react-markdown).
 * Como no changelog do Linear: seções com subtítulo (## e ###) e, se
 * quiser, sua imagem ou animação (`![](/novidades/arquivo.webp)`). Na página
 * da novidade (`comLinksDasSecoes`), cada subtítulo ganha um link próprio
 * (ícone ao passar o mouse); na lista, não: lá se entra primeiro na novidade. Links internos ("/modulos/...")
 * navegam dentro do Atlas; "//outro-endereco" conta como externo.
 */
export function TextoDaNovidade({
  markdown,
  idDaNovidade,
  comLinksDasSecoes = false,
}: {
  markdown: string;
  idDaNovidade: string;
  comLinksDasSecoes?: boolean;
}) {
  function Subtitulo({ nivel, node, children }: { nivel: 2 | 3; node?: No; children?: React.ReactNode }) {
    const id = `${idDaNovidade}--${ancora(textoDoNo(node))}`;
    const Tag = nivel === 2 ? "h2" : "h3";
    return (
      <Tag
        id={id}
        className={
          nivel === 2
            ? "group flex scroll-mt-6 items-center gap-2 pt-4 text-xl font-semibold tracking-tight text-foreground"
            : "group flex scroll-mt-6 items-center gap-2 pt-3 text-base font-semibold text-foreground"
        }
      >
        {children}
        {comLinksDasSecoes && (
          <a
            href={`#${id}`}
            aria-label={`Link para "${textoDoNo(node)}"`}
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Link2 className="size-4" aria-hidden />
          </a>
        )}
      </Tag>
    );
  }

  const componentes: Components = {
    // Imagem sozinha num parágrafo vira a mídia da seção, sem o <p> em volta.
    p: ({ node, children }) => {
      const filhos = (node as No | undefined)?.children ?? [];
      if (filhos.length === 1 && filhos[0].tagName === "img") return <>{children}</>;
      return <p>{children}</p>;
    },
    img: ({ src, alt }) => (typeof src === "string" ? <MidiaDaNovidade src={src} alt={alt ?? ""} /> : null),
    h2: ({ node, children }) => (
      <Subtitulo nivel={2} node={node as No}>
        {children}
      </Subtitulo>
    ),
    h3: ({ node, children }) => (
      <Subtitulo nivel={3} node={node as No}>
        {children}
      </Subtitulo>
    ),
    ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-5 marker:text-border">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>,
    a: ({ href, children }) =>
      href && ehCaminhoInterno(href) ? (
        <Link href={href} className="font-medium text-primary hover:underline">
          {children}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          {children}
        </a>
      ),
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  };

  return <ReactMarkdown components={componentes}>{markdown}</ReactMarkdown>;
}
