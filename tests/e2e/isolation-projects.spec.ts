import { expect, test, type APIResponse, type BrowserContext, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL, E2E_TEST_EMAIL_B, FIXTURE_CRAG_PATH, FIXTURE_ROUTE_NAME } from "./constants";
import {
  createAuthenticatedContext,
  deleteProjectViaApi,
  getAuthenticatedRequest,
  waitForProjectCreated,
} from "./helpers";

/**
 * Provenance: `context/foundation/test-plan.md` Risk #2 and
 * `context/changes/private-climber-flows-isolation/plan.md` Phase 2.
 *
 * Protects the cross-user mutation boundary for private projects: user B must
 * receive `not_found` for user A's project row id. Projects have no PATCH
 * endpoint, so DELETE is the mutation denial surface.
 */

let contextA: BrowserContext | undefined;
let contextB: BrowserContext | undefined;
let pageA: Page | undefined;
let pageB: Page | undefined;
let projectId: string | null = null;

test.describe.configure({ mode: "serial" });

test.describe("Risk #2 project isolation", () => {
  test.beforeAll(async ({ browser }) => {
    const authA = await createAuthenticatedContext(browser, { email: E2E_TEST_EMAIL, next: FIXTURE_CRAG_PATH });
    contextA = authA.context;
    pageA = authA.page;

    await ensureFixtureProjectOffList(pageA);
    projectId = await addFixtureProject(pageA);

    const authB = await createAuthenticatedContext(browser, { email: E2E_TEST_EMAIL_B, next: FIXTURE_CRAG_PATH });
    contextB = authB.context;
    pageB = authB.page;
  });

  test.afterAll(async () => {
    if (pageA && projectId) {
      await deleteProjectViaApi(pageA, projectId);
    }
    await contextB?.close();
    await contextA?.close();
  });

  test("Risk #2: user B cannot DELETE user A project", async () => {
    if (!pageB || !projectId) {
      throw new Error("setup should create user B session and user A project before DELETE denial");
    }

    // PLAN step: B attempts to delete A's row id through the authenticated API.
    const response = await getAuthenticatedRequest(pageB).delete("/api/projects", {
      data: { id: projectId },
    });

    await expectNotFound(response, "user B DELETE of user A project should be hidden as not_found");
  });
});

async function addFixtureProject(page: Page): Promise<string> {
  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const addButton = routeRow.getByRole("button", { name: "Dodaj do projektów" });

  // PLAN step: user A creates a private project through the real crag-row UI.
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

async function expectNotFound(response: APIResponse, message: string): Promise<void> {
  expect(response.status(), message).toBe(404);
  expect(response.headers()["content-type"] ?? "", `${message}: response should be JSON`).toContain("application/json");

  const body = (await response.json()) as {
    error?: { code?: string; message?: string; context?: unknown };
  };

  expect(body, message).toMatchObject({
    error: {
      code: "not_found",
      message: expect.any(String) as string,
    },
  });
}
