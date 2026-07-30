import { expect, test } from "@playwright/test";

// Único usuário seedado (seed_e2e_usuario, Admin Q&G) atua como solicitante,
// responsável e aprovador ao mesmo tempo -- suficiente porque Admin Q&G
// passa em todos os gates de permissão do fluxo (isAdminOps=true cobre
// TRANSICOES_ADMIN_ONLY e TRANSICOES_SO_APROVADOR_OU_ADMIN, ver
// src/lib/kanban.ts) sem precisar de um segundo usuário.
const TITULO = `[E2E] Demanda de teste ${Date.now()}`;

test("fluxo principal: criar demanda, mover no board, comentar e concluir", async ({ page }) => {
  await page.goto("/modulos/gestao-demandas");
  // networkidle espera a leva inicial de fetches (board, filtros, resumo)
  // assentar antes de interagir -- o polling de 10s (STC-206) não
  // atrapalha, sobra folga de sobra pra achar uma janela de 500ms sem rede.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Nova Demanda" })).toBeVisible();

  // 1. Criar demanda -- mesmos campos/seletores que
  // FormNovaDemanda.test.tsx já usa (id/aria-label da STC-215).
  await page.getByRole("button", { name: "Nova Demanda" }).click();
  const formulario = page.getByRole("dialog");
  await formulario.getByLabel(/título/i).fill(TITULO);
  await formulario.getByLabel(/descrição/i).fill("Criada pela suíte E2E (STC-216).");
  await formulario.getByRole("button", { name: "Média", exact: true }).click();
  await formulario.getByLabel(/prazo/i).fill("2026-12-31");

  await formulario.getByLabel(/^unidade/i).click();
  await page.getByRole("option", { name: "Niterói" }).click();

  await formulario.getByLabel(/tipo de gestão/i).click();
  await page.getByRole("option", { name: "Operacional" }).click();

  await formulario.getByRole("button", { name: "Criar Demanda" }).click();
  await expect(formulario).not.toBeVisible();

  const card = page.locator(`[aria-label^="Demanda ${TITULO},"]`);
  await expect(card).toBeVisible();

  // 2. Atribuir responsável principal -- pré-requisito de negócio pra sair
  // do Backlog (backlog->em_andamento exige DemandaResponsavel principal).
  await card.click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByText(TITULO)).toBeVisible();

  await modal.getByRole("button", { name: "Adicionar responsável" }).click();
  await modal.getByLabel("Usuário responsável").click();
  await page.getByRole("option").first().click();
  await modal.getByLabel("Tipo de responsável").click();
  await page.getByRole("option", { name: "Principal" }).click();
  await modal.getByRole("button", { name: "Adicionar", exact: true }).click();

  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();

  // 3. Mover no board: drag real via mouse, não HTML5 drag -- dnd-kit usa
  // PointerSensor com activationConstraint:{distance:6} (KanbanBoard.tsx),
  // por isso o move em vários passos antes de soltar.
  const origem = await card.boundingBox();
  const destino = await page.locator('[data-testid="em_andamento"]').boundingBox();
  if (!origem || !destino) throw new Error("Não foi possível medir card/coluna pro drag.");

  // Pausas curtas entre os passos -- achado depurando isoladamente: sem
  // elas, o PointerSensor às vezes não termina de "armar" o drag antes do
  // grande salto até a coluna de destino, e o gesto inteiro degenera num
  // clique comum (abre o modal em vez de mover o card).
  await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(origem.x + origem.width / 2 + 15, origem.y + origem.height / 2, {
    steps: 5,
  });
  await page.waitForTimeout(100);
  await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height / 2, {
    steps: 20,
  });
  await page.waitForTimeout(150);
  await page.mouse.up();

  await expect(page.locator('[data-testid="em_andamento"]').locator(card)).toBeVisible();

  // 4. Comentar.
  await card.click();
  await expect(modal.getByText(TITULO)).toBeVisible();
  const caixaDeComentario = modal.getByPlaceholder("Adicionar comentário... (Enter para enviar)");
  await caixaDeComentario.fill("Comentário de verificação da suíte E2E.");
  await caixaDeComentario.press("Enter");
  await expect(modal.getByText("Comentário de verificação da suíte E2E.")).toBeVisible();

  // 5. Mudar status até concluir: em_andamento -> em_revisao (exige
  // aprovador) -> concluido (Admin Q&G decide, sem exigir aprovador
  // designado nem justificativa nesse par).
  await modal.getByRole("button", { name: "Mudar status" }).click();
  await modal.getByLabel("Novo status").click();
  await page.getByRole("option", { name: "Em Revisão" }).click();
  await modal.getByLabel("Aprovador").click();
  await page.getByRole("option").first().click();
  await modal.getByRole("button", { name: "Confirmar" }).click();

  await expect(modal.getByText("Em Revisão", { exact: true })).toBeVisible();

  await modal.getByRole("button", { name: "Mudar status" }).click();
  await modal.getByLabel("Novo status").click();
  await page.getByRole("option", { name: "Concluído" }).click();
  await modal.getByRole("button", { name: "Confirmar" }).click();

  await expect(modal.getByText("Concluído", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="concluido"]').locator(card)).toBeVisible();
});
