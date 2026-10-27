import { cn } from "@/lib/utils";

/**
 * Print ou animação (WebP/GIF) das Novidades e da Ajuda. As imagens são gravadas em 2x
 * (`srcSet ... 2x`): aparecem na metade dos pixels, nítidas, e nunca são
 * esticadas. Uma tela de celular fica estreita e centralizada sobre um fundo
 * suave; um print de computador ocupa a largura da coluna. `alt` descreve o
 * que a imagem mostra, para leitor de tela.
 */
export function MidiaDoConteudo({
  src,
  alt,
  alturaMaxima = "max-h-[36rem]",
}: {
  src: string;
  alt: string;
  alturaMaxima?: string;
}) {
  return (
    <figure className="flex justify-center rounded-xl bg-muted/60 p-3 sm:p-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem de conteúdo, tamanho livre */}
      <img
        src={src}
        srcSet={`${src} 2x`}
        alt={alt}
        loading="lazy"
        className={cn("block h-auto w-auto max-w-full rounded-lg border border-border shadow-sm", alturaMaxima)}
      />
    </figure>
  );
}
