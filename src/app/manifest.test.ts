import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COR_DA_MARCA } from "@/lib/marca";
import manifest from "./manifest";

describe("manifesto do app instalável (STC-786)", () => {
  const app = manifest();

  it("abre em tela cheia, com o nome e a cor da marca", () => {
    expect(app).toMatchObject({
      short_name: "Atlas",
      display: "standalone",
      start_url: "/",
      scope: "/",
      theme_color: COR_DA_MARCA,
      background_color: COR_DA_MARCA,
    });
  });

  it("tem ícones de 192 e 512 e um recortável, e todos existem em public/", () => {
    const icones = app.icons ?? [];
    expect(icones.map((icone) => `${icone.sizes}:${icone.purpose}`)).toEqual([
      "192x192:any",
      "512x512:any",
      "512x512:maskable",
    ]);
    for (const icone of icones) {
      expect(existsSync(path.join(process.cwd(), "public", icone.src))).toBe(true);
    }
  });
});
