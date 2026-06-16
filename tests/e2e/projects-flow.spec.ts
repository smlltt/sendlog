import { expect, test, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL, FIXTURE_CRAG_PATH, FIXTURE_ROUTE_NAME } from "./constants";
import { signInViaMagicLink } from "./helpers";

/**
 * Provenance: `context/foundation/test-plan.md` Risk #4 and
 * `context/changes/private-climber-flows-isolation/plan.md` Phase 3.
 *
 * Protects project persistence: adding a route through the crag-row toggle must
 * render on `/projekty`, survive reload, and be removable from the saved list.
 */

test("Risk #4: project add persists to projects page and remove clears it", async ({ page }) => {
  await signInViaMagicLink(page, { email: E2E_TEST_EMAIL, next: FIXTURE_CRAG_PATH });

  // PLAN step: start from a deterministic off-list state for this user.
  await ensureFixtureProjectOffList(page);

  // PLAN step: add the fixture route through the real crag-row ProjectAction.
  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const addButton = routeRow.getByRole("button", { name: "Dodaj do projektów" });

  await expect(async () => {
    await addButton.click();
    await expect(routeRow.getByText("Dodano do projektów.")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(routeRow.getByText("Dodano do projektów.")).toBeVisible();
  await expect(routeRow.getByText("W projektach")).toBeVisible();

  // PLAN step: navigate to the gated projects list and assert persisted state.
  await page.goto("/projekty");

  const projectRow = page.getByRole("listitem").filter({ hasText: FIXTURE_ROUTE_NAME });
  await expect(projectRow).toBeVisible();
  await expect(projectRow.getByRole("heading", { name: FIXTURE_ROUTE_NAME })).toBeVisible();

  await page.reload();

  const persistedProjectRow = page.getByRole("listitem").filter({ hasText: FIXTURE_ROUTE_NAME });
  await expect(persistedProjectRow).toBeVisible();
  await expect(persistedProjectRow.getByRole("heading", { name: FIXTURE_ROUTE_NAME })).toBeVisible();

  // PLAN step: remove from `/projekty` and verify the saved row disappears.
  const confirmPrompt = persistedProjectRow.getByText("Usunąć z projektów?");
  await expect(async () => {
    await persistedProjectRow.getByRole("button", { name: "Usuń" }).click();
    await expect(confirmPrompt).toBeVisible({ timeout: 1000 });
  }).toPass();
  await persistedProjectRow.getByRole("button", { name: "Usuń" }).click();

  await expect(page.getByText("Usunięto z projektów.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: FIXTURE_ROUTE_NAME })).toHaveCount(0);
});

async function ensureFixtureProjectOffList(page: Page): Promise<void> {
  await page.goto(FIXTURE_CRAG_PATH);

  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const onListIndicator = routeRow.getByText("W projektach");

  if (!(await onListIndicator.isVisible())) {
    return;
  }

  await expect(async () => {
    await routeRow.getByRole("button", { name: "Usuń" }).click();
    await expect(routeRow.getByText("Usunąć z projektów?")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await routeRow.getByRole("button", { name: "Usuń" }).click();
  await expect(routeRow.getByRole("button", { name: "Dodaj do projektów" })).toBeVisible();
}
