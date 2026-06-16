import { expect, test } from "@playwright/test";
import { E2E_TEST_EMAIL, FIXTURE_CRAG_PATH, FIXTURE_ROUTE_NAME } from "./constants";
import { signInViaMagicLink } from "./helpers";

/**
 * seed.spec.ts — the exemplar every generated e2e test is modeled on.
 *
 * It is deliberately bound to one risk from `context/foundation/test-plan.md`
 * (Risk #3: "A logged climb appears in history with the correct route/date/
 * note, survives reload ... and delete removes it.") and demonstrates the five
 * conventions this project's e2e tests must follow:
 *
 *   1. `getByRole` / `getByLabel` / `getByText` are the default locators —
 *      never CSS selectors, XPath, or DOM structure.
 *   2. Wait for application state (`toBeVisible`, `toHaveURL`, `toHaveCount`),
 *      never for a fixed duration (`waitForTimeout`).
 *   3. Test data carries a unique identifier (a timestamped note) so parallel
 *      runs and re-runs after a crash never collide.
 *   4. The test cleans up the data it creates so the next run starts clean.
 *   5. The test name names the risk, not "test 1".
 *
 * The session is established through the real passwordless magic-link path
 * (`signInViaMagicLink`), never a mocked auth shortcut — Risk #1 is only
 * exercised when the test goes through the real Supabase session + middleware.
 *
 * Local prerequisites: `npx supabase start` (Mailpit + auth) and a local Strapi
 * catalog containing the seeded fixture (`FIXTURE_CRAG_PATH` /
 * `FIXTURE_ROUTE_NAME` in `./constants`). See test-plan §6.1.
 */

test("logged climb persists in history after page reload", async ({ page }) => {
  // Unique per run so a leftover row from a crashed earlier run never collides
  // with this one (convention #3). The note is also the oracle we assert on.
  const note = `seed climb ${Date.now()}`;

  // Sign in through the real magic-link path (never a mocked session) and let
  // the post-confirm redirect land us straight on the seeded crag page.
  await signInViaMagicLink(page, { email: E2E_TEST_EMAIL, next: FIXTURE_CRAG_PATH });

  // --- Setup + action: log a climb on the seeded route ---------------------
  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const openLogForm = routeRow.getByRole("button", { name: /Dodaj.*przejście/ });
  const noteField = routeRow.getByLabel("Notatka (opcjonalnie)");

  // `RouteClimbAction` is a `client:load` island, so an early click can land
  // before React attaches its handler. Retry opening the form until it mounts —
  // a state-based wait, never a fixed sleep (convention #2).
  await expect(async () => {
    await openLogForm.click();
    await expect(noteField).toBeVisible({ timeout: 1000 });
  }).toPass();

  await noteField.fill(note);
  await routeRow.getByRole("button", { name: "Zapisz przejście" }).click();

  // Wait for the saved state, not a timeout (convention #2).
  await expect(routeRow.getByText("Zapisano przejście.")).toBeVisible();

  // --- Assertion: the climb is in history and survives a reload ------------
  await page.goto("/historia");

  const historyRow = page.getByRole("listitem").filter({ hasText: note });
  await expect(historyRow).toBeVisible();
  await expect(historyRow.getByRole("heading", { name: FIXTURE_ROUTE_NAME })).toBeVisible();

  await page.reload();

  // The control question for Risk #3: would this fail if the climb did not
  // persist across the reload? Yes — so the assertion protects the risk.
  await expect(historyRow).toBeVisible();
  await expect(historyRow.getByText(note)).toBeVisible();

  // --- Cleanup: delete the climb this test created (convention #4) ---------
  // `HistoryClimbCard` is also a `client:load` island; retry the two-step
  // delete until the confirm prompt appears, then confirm.
  const confirmPrompt = historyRow.getByText("Usunąć to przejście?");
  await expect(async () => {
    await historyRow.getByRole("button", { name: "Usuń" }).click();
    await expect(confirmPrompt).toBeVisible({ timeout: 1000 });
  }).toPass();
  await historyRow.getByRole("button", { name: "Usuń" }).click();

  await expect(page.getByText("Przejście zostało usunięte.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: note })).toHaveCount(0);
});
