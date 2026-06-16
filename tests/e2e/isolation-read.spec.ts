import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL, E2E_TEST_EMAIL_B, FIXTURE_CRAG_PATH, FIXTURE_ROUTE_NAME } from "./constants";
import {
  createAuthenticatedContext,
  deleteClimbViaApi,
  deleteProjectViaApi,
  waitForClimbCreated,
  waitForProjectCreated,
} from "./helpers";

/**
 * Provenance: `context/foundation/test-plan.md` Risk #2 and
 * `context/changes/private-climber-flows-isolation/plan.md` Phase 2.
 *
 * Protects SSR read isolation: user B's gated history/projects pages must not
 * render rows created by user A, even when both users are signed in at once.
 */

let contextA: BrowserContext | undefined;
let contextB: BrowserContext | undefined;
let pageA: Page | undefined;
let pageB: Page | undefined;
let climbId: string | null = null;
let projectId: string | null = null;
let ownerNote: string;

test.describe.configure({ mode: "serial" });

test.describe("Risk #2 UI read isolation", () => {
  test.beforeAll(async ({ browser }) => {
    const authA = await createAuthenticatedContext(browser, { email: E2E_TEST_EMAIL, next: FIXTURE_CRAG_PATH });
    contextA = authA.context;
    pageA = authA.page;

    const authB = await createAuthenticatedContext(browser, { email: E2E_TEST_EMAIL_B, next: FIXTURE_CRAG_PATH });
    contextB = authB.context;
    pageB = authB.page;

    await ensureFixtureProjectOffList(pageA);
    await ensureFixtureProjectOffList(pageB);

    ownerNote = `risk2 owner read ${Date.now()}`;
    climbId = await createFixtureClimb(pageA, ownerNote);
    projectId = await addFixtureProject(pageA);

    // Owner sanity checks: setup must prove A can see A's rows before B's pages
    // are allowed to prove absence.
    await pageA.goto("/historia");
    await expect(pageA.getByRole("listitem").filter({ hasText: ownerNote })).toBeVisible();

    await pageA.goto("/projekty");
    await expect(pageA.getByRole("listitem").filter({ hasText: FIXTURE_ROUTE_NAME })).toBeVisible();
  });

  test.afterAll(async () => {
    if (pageA && climbId) {
      await deleteClimbViaApi(pageA, climbId);
    }
    if (pageA && projectId) {
      await deleteProjectViaApi(pageA, projectId);
    }
    await contextB?.close();
    await contextA?.close();
  });

  test("Risk #2: user B cannot read user A history or projects rows", async () => {
    if (!pageB) {
      throw new Error("setup should create user B session before read-isolation assertions");
    }

    // PLAN step: B visits the SSR history page; A's unique note is the leak oracle.
    await pageB.goto("/historia");
    await expect(pageB.getByRole("heading", { name: "Historia" })).toBeVisible();
    await expect(
      pageB.getByRole("listitem").filter({ hasText: ownerNote }),
      "user B /historia leaked user A climb note",
    ).toHaveCount(0);

    // PLAN step: B visits the SSR projects page; B was reset off-list first, so
    // seeing the fixture route here would indicate A's project leaked.
    await pageB.goto("/projekty");
    await expect(pageB.getByRole("heading", { name: "Projekty" })).toBeVisible();
    await expect(
      pageB.getByRole("listitem").filter({ hasText: FIXTURE_ROUTE_NAME }),
      "user B /projekty leaked user A project row",
    ).toHaveCount(0);
  });
});

async function createFixtureClimb(page: Page, note: string): Promise<string> {
  await page.goto(FIXTURE_CRAG_PATH);

  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const openLogForm = routeRow.getByRole("button", { name: /Dodaj.*przejście/ });
  const noteField = routeRow.getByLabel("Notatka (opcjonalnie)");

  await expect(async () => {
    await openLogForm.click();
    await expect(noteField).toBeVisible({ timeout: 1000 });
  }).toPass();

  await noteField.fill(note);
  const climbCreated = waitForClimbCreated(page);
  await routeRow.getByRole("button", { name: "Zapisz przejście" }).click();
  const createdClimbId = await climbCreated;

  await expect(routeRow.getByText("Zapisano przejście.")).toBeVisible();
  return createdClimbId;
}

async function addFixtureProject(page: Page): Promise<string> {
  await page.goto(FIXTURE_CRAG_PATH);

  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const addButton = routeRow.getByRole("button", { name: "Dodaj do projektów" });

  await expect(addButton).toBeVisible();
  const projectCreated = waitForProjectCreated(page);
  await addButton.click();
  const createdProjectId = await projectCreated;

  await expect(routeRow.getByText("W projektach")).toBeVisible();
  await expect(routeRow.getByText("Dodano do projektów.")).toBeVisible();
  return createdProjectId;
}

async function ensureFixtureProjectOffList(page: Page): Promise<void> {
  await page.goto(FIXTURE_CRAG_PATH);

  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const onListIndicator = routeRow.getByText("W projektach");

  if (!(await onListIndicator.isVisible())) {
    return;
  }

  await routeRow.getByRole("button", { name: "Usuń" }).click();
  await expect(routeRow.getByText("Usunąć z projektów?")).toBeVisible();
  await routeRow.getByRole("button", { name: "Usuń" }).click();
  await expect(routeRow.getByRole("button", { name: "Dodaj do projektów" })).toBeVisible();
}
