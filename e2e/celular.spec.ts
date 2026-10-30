import { expect, test, type Page } from "@playwright/test";
import { fecharNovidadeEmDestaque } from "./apoio";

// STC-959: no celular, abrir um menu do Radix somava ao body uma margem do
// tamanho de uma "barra de rolagem" de centenas de pixels (react-remove-
// scroll-bar), o body ficava com largura 0 e só o menu aparecia. Só acontece
// com a emulação de aparelho (projeto "celular" do playwright.config.ts).

async function larguraDoBody(page: Page) {
  return page.evaluate(() => document.body.getBoundingClientRect().width);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/modulos/gestao-demandas");
  await page.waitForLoadState("networkidle");
  await fecharNovidadeEmDestaque(page);
});

test("sino: a tela continua visível e a caixa cabe na tela", async ({ page }) => {
  const tela = page.viewportSize()!;

  await page.getByRole("button", { name: /^Notificações/ }).click();
  const caixa = page.locator('[data-slot="dropdown-menu-content"]');
  await expect(caixa).toBeVisible();

  expect(await larguraDoBody(page)).toBe(tela.width);
  await expect(page.locator("header").first()).toBeInViewport();
  // Pelo atributo, não pelo papel: com o menu aberto, o Radix marca o resto
  // da página com aria-hidden e o getByRole não acharia a navegação.
  const navegacao = page.locator('nav[aria-label="Navegação principal"]');
  await expect(navegacao).toBeInViewport();

  // Largura da tela com 8px de cada lado, sem passar da navegação inferior.
  const posicao = (await caixa.boundingBox())!;
  expect(posicao.x).toBeGreaterThanOrEqual(7.5);
  expect(posicao.x + posicao.width).toBeLessThanOrEqual(tela.width - 7.5);
  const topoDaNavegacao = (await navegacao.boundingBox())!.y;
  expect(posicao.y + posicao.height).toBeLessThanOrEqual(topoDaNavegacao);
});

test("menu do avatar: a tela continua visível", async ({ page }) => {
  const tela = page.viewportSize()!;

  await page.locator("header button").last().click();
  await expect(page.getByRole("menu")).toBeVisible();

  expect(await larguraDoBody(page)).toBe(tela.width);
  await expect(page.locator("header").first()).toBeInViewport();
});
