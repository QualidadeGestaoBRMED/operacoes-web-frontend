import type { MetadataRoute } from "next";
import { COR_DA_MARCA } from "@/lib/marca";

// Atlas instalável no celular (STC-786): abre em tela cheia, sem a barra do
// navegador, com o ícone da BR MED. Sem service worker: o Atlas não funciona
// sem internet, e o Chrome instala sem ele.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Atlas - BR MED",
    short_name: "Atlas",
    description: "Hub de operações BR MED",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: COR_DA_MARCA,
    theme_color: COR_DA_MARCA,
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icone-mascaravel-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
