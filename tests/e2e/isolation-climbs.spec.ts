import { expect, test, type APIResponse, type BrowserContext, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL, E2E_TEST_EMAIL_B, FIXTURE_CRAG_PATH, FIXTURE_ROUTE_NAME } from "./constants";
import { createAuthenticatedContext, deleteClimbViaApi, getAuthenticatedRequest, waitForClimbCreated } from "./helpers";

/**
 * Provenance: `context/foundation/test-plan.md` Risk #2 and
 * `context/changes/private-climber-flows-isolation/plan.md` Phase 2.
 *
 * Protects the cross-user mutation boundary for private climbs: user B must
 * receive `not_found` for user A's row id, never success or an ownership leak.
 * Follows `seed.spec.ts` for auth, locators, unique data, and cleanup.
 */

let contextA: BrowserContext | undefined;
let contextB: BrowserContext | undefined;
let pageA: Page | undefined;
let pageB: Page | undefined;
let climbId: string | null = null;

test.describe.configure({ mode: "serial" });

test.describe("Risk #2 climb isolation", () => {
  test.beforeAll(async ({ browser }) => {
    const authA = await createAuthenticatedContext(browser, { email: E2E_TEST_EMAIL, next: FIXTURE_CRAG_PATH });
    contextA = authA.context;
    pageA = authA.page;

    const note = `risk2 owner climb ${Date.now()}`;
    climbId = await createFixtureClimb(pageA, note);

    const authB = await createAuthenticatedContext(browser, { email: E2E_TEST_EMAIL_B, next: FIXTURE_CRAG_PATH });
    contextB = authB.context;
    pageB = authB.page;
  });

  test.afterAll(async () => {
    if (pageA && climbId) {
      await deleteClimbViaApi(pageA, climbId);
    }
    await contextB?.close();
    await contextA?.close();
  });

  test("Risk #2: user B cannot PATCH or DELETE user A climb", async () => {
    if (!pageB || !climbId) {
      throw new Error("setup should create user B session and user A climb before mutation denial");
    }

    // PLAN step: B attempts to edit A's row id through the authenticated API.
    const patchResponse = await getAuthenticatedRequest(pageB).patch("/api/climbs", {
      data: {
        id: climbId,
        climbedOn: "2020-01-01",
        note: "user B attempted to edit user A climb",
      },
    });

    await expectNotFound(patchResponse, "user B PATCH of user A climb should be hidden as not_found");

    // PLAN step: B attempts to delete A's row id through the authenticated API.
    const deleteResponse = await getAuthenticatedRequest(pageB).delete("/api/climbs", {
      data: { id: climbId },
    });

    await expectNotFound(deleteResponse, "user B DELETE of user A climb should be hidden as not_found");
  });
});

async function createFixtureClimb(page: Page, note: string): Promise<string> {
  const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
  const openLogForm = routeRow.getByRole("button", { name: /Dodaj.*przejście/ });
  const noteField = routeRow.getByLabel("Notatka (opcjonalnie)");

  // PLAN step: user A creates a private climb through the real crag-row UI.
  await expect(async () => {
    await openLogForm.click();
    await expect(noteField).toBeVisible({ timeout: 1000 });
  }).toPass();

  await noteField.fill(note);
  const climbCreated = waitForClimbCreated(page);
  await routeRow.getByRole("button", { name: "Zapisz przejście" }).click();
  const createdClimbId = await climbCreated;

  // Sanity check: the owner's session can see the created row before B probes it.
  await expect(routeRow.getByText("Zapisano przejście.")).toBeVisible();
  await page.goto("/historia");
  await expect(page.getByRole("listitem").filter({ hasText: note })).toBeVisible();

  return createdClimbId;
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
