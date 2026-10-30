import { expect, type Page } from "@playwright/test";

/**
 * O usuário da suíte é novo: a Novidade em destaque mais recente abre
 * sozinha por cima da tela (JanelaDeDestaque) e esconde o resto da página.
 * A janela só abre depois que /auth/me responde, então espera um pouco por
 * ela antes de seguir.
 */
export async function fecharNovidadeEmDestaque(page: Page) {
  const destaque = page.locator('[data-slot="dialog-content"]');
  try {
    await destaque.waitFor({ state: "visible", timeout: 3000 });
  } catch {
    return;
  }
  await page.keyboard.press("Escape");
  await expect(destaque).toBeHidden();
}
