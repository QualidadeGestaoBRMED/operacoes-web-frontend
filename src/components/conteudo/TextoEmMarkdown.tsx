import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link2 } from "lucide-react";
import { MidiaDoConteudo } from "@/components/conteudo/MidiaDoConteudo";
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
 * Texto de uma novidade ou de um artigo da Ajuda, montado no servidor (o
 * leitor de Markdown não vai para o navegador; sem HTML no conteúdo, o
 * padrão do react-markdown). Como no Linear: seções com subtítulo (## e ###)
 * e, se quiser, sua imagem ou animação (`![O que mostra](/pasta/arquivo.webp)`).
 * Na página própria (`comLinksDasSecoes`), cada subtítulo ganha um link
 * próprio (ícone ao passar o mouse); na lista das Novidades, não. Lista
 * numerada vira passos, com o número em destaque. Links internos
 * ("/modulos/...") navegam dentro do Atlas; "//outro-endereco" conta como
 * externo.
 */
export function TextoEmMarkdown({
  markdown,
  prefixoDasAncoras,
  comLinksDasSecoes = false,
}: {
  markdown: string;
  prefixoDasAncoras: string;
  comLinksDasSecoes?: boolean;
}) {
  // Subtítulos repetidos (dois "Melhorias") ganham "-2", "-3"; só símbolos, "secao".
  const usadas = new Map<string, number>();
  function idDaSecao(texto: string): string {
    const base = ancora(texto) || "secao";
    const vezes = (usadas.get(base) ?? 0) + 1;
    usadas.set(base, vezes);
    return `${prefixoDasAncoras}--${vezes === 1 ? base : `${base}-${vezes}`}`;
  }

  function Subtitulo({ nivel, node, children }: { nivel: 2 | 3; node?: No; children?: React.ReactNode }) {
    const id = idDaSecao(textoDoNo(node));
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
    img: ({ src, alt }) => (typeof src === "string" ? <MidiaDoConteudo src={src} alt={alt ?? ""} /> : null),
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
    ol: ({ children }) => (
      <ol className="space-y-4 [counter-reset:passo] [&>li]:relative [&>li]:min-h-6 [&>li]:pl-9 [&>li]:[counter-increment:passo] [&>li]:before:absolute [&>li]:before:top-0.5 [&>li]:before:left-0 [&>li]:before:flex [&>li]:before:size-6 [&>li]:before:items-center [&>li]:before:justify-center [&>li]:before:rounded-full [&>li]:before:bg-primary/10 [&>li]:before:text-xs [&>li]:before:font-semibold [&>li]:before:text-primary [&>li]:before:content-[counter(passo)]">
        {children}
      </ol>
    ),
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
