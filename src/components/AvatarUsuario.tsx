"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Foto de perfil do Google da pessoa (`Usuario.foto_url`, gravada no login)
 * ou, sem ela ou se não carregar, as iniciais. Tamanho e cores das iniciais
 * vêm de quem usa, em `className`.
 */
export function AvatarUsuario({
  imagem,
  iniciais,
  className,
}: {
  imagem?: string | null;
  iniciais: string;
  className?: string;
}) {
  // Guarda qual foto falhou, não só "falhou": se a mesma posição passar a
  // mostrar outra pessoa (responsável trocado), a foto nova é tentada.
  const [fotoQueFalhou, setFotoQueFalhou] = useState<string | null>(null);

  if (imagem && imagem !== fotoQueFalhou) {
    return (
      // referrerPolicy="no-referrer": sem isso, a foto de perfil do Google
      // costuma falhar ao carregar (o Google recusa servir a imagem com o
      // Referer do nosso domínio). <img> puro de propósito, não next/image:
      // é um avatar pequeno, não justifica configurar remotePatterns no
      // next.config.ts só por isso.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imagem}
        alt=""
        referrerPolicy="no-referrer"
        className={cn("size-8 shrink-0 rounded-full object-cover", className)}
        onError={() => setFotoQueFalhou(imagem)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        className,
      )}
    >
      {iniciais}
    </div>
  );
}
