import { expect, test } from "@playwright/test";
import { E2E_TEST_EMAIL, FIXTURE_CRAG_PATH, FIXTURE_ROUTE_NAME } from "./constants";
import { signInViaMagicLink } from "./helpers";

/**
 * Provenance: `context/foundation/test-plan.md` Risk #3 and
 * `context/changes/private-climber-flows-isolation/plan.md` Phase 3.
 *
 * Protects climb edit persistence: updating a note on `/historia` must PATCH
 * the private row and survive a real SSR page reload, not just update optimistic
 * client state.
 */

test("Risk #3: edited climb note persists after history reload", async ({ page }) => {
  const initialNote = `edit-before-${Date.now()}`;
  const updatedNote = `edit-after-${Date.now()}`;

  await signInViaMagicLink(page, { email: E2E_TEST_EMAIL, next: FIXTURE_CRAG_PATH });

  // PLAN step: create a private climb through the real crag-row UI.
  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const openLogForm = routeRow.getByRole("button", { name: /Dodaj.*przejście/ });
  const createNoteField = routeRow.getByLabel("Notatka (opcjonalnie)");

  await expect(async () => {
    await openLogForm.click();
    await expect(createNoteField).toBeVisible({ timeout: 1000 });
  }).toPass();

  await createNoteField.fill(initialNote);
  await routeRow.getByRole("button", { name: "Zapisz przejście" }).click();
  await expect(routeRow.getByText("Zapisano przejście.")).toBeVisible();

  // PLAN step: edit the created climb on the gated history page.
  await page.goto("/historia");

  const historyRow = page.getByRole("listitem").filter({ hasText: initialNote });
  await expect(historyRow).toBeVisible();
  await expect(historyRow.getByRole("heading", { name: FIXTURE_ROUTE_NAME })).toBeVisible();

  const editNoteField = historyRow.getByLabel("Notatka (opcjonalnie)");
  await expect(async () => {
    await historyRow.getByRole("button", { name: "Edytuj" }).click();
    await expect(editNoteField).toBeVisible({ timeout: 1000 });
  }).toPass();

  await editNoteField.fill(updatedNote);
  await historyRow.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(page.getByText("Zmiany zostały zapisane.")).toBeVisible();

  // PLAN step: reload proves persistence instead of an optimistic-only patch.
  await page.reload();

  const updatedHistoryRow = page.getByRole("listitem").filter({ hasText: updatedNote });
  await expect(updatedHistoryRow).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: initialNote })).toHaveCount(0);

  // PLAN step: clean up the climb this spec created.
  const confirmPrompt = updatedHistoryRow.getByText("Usunąć to przejście?");
  await expect(async () => {
    await updatedHistoryRow.getByRole("button", { name: "Usuń" }).click();
    await expect(confirmPrompt).toBeVisible({ timeout: 1000 });
  }).toPass();
  await updatedHistoryRow.getByRole("button", { name: "Usuń" }).click();

  await expect(page.getByText("Przejście zostało usunięte.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: updatedNote })).toHaveCount(0);
});
