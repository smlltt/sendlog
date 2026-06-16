import { expect, test, type APIResponse } from "@playwright/test";

/**
 * Anonymous mutation denial for the two private endpoints.
 *
 * Risk #2 (private data / authorization): every climb and project mutation
 * verb must reject signed-out callers with a structured JSON `401`, never an
 * HTML redirect. `/api/climbs` and `/api/projects` are intentionally outside
 * `PROTECTED_ROUTES` so the React islands receive machine-readable errors.
 *
 * The `request` fixture carries no session cookies, so every call here is
 * unauthenticated. A placeholder UUID stands in for a row id — the request
 * never reaches ownership checks because auth is denied first; the body still
 * has to pass input validation, which runs before the auth gate.
 */

const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000001";

async function expectUnauthenticatedJson(response: APIResponse, apiPath: RegExp): Promise<void> {
  expect(response.status()).toBe(401);
  expect(response.url()).toMatch(apiPath);

  const contentType = response.headers()["content-type"] ?? "";
  expect(contentType).toContain("application/json");

  const body = (await response.json()) as {
    error?: { code?: string; message?: string; context?: unknown };
  };

  expect(body).toMatchObject({
    error: {
      code: "unauthenticated",
      message: expect.any(String) as string,
    },
  });
}

test("POST /api/climbs returns JSON 401 when unauthenticated", async ({ request }) => {
  const response = await request.post("/api/climbs", {
    data: { routeId: "test", climbedOn: "2026-01-01" },
  });

  await expectUnauthenticatedJson(response, /\/api\/climbs$/);
});

test("PATCH /api/climbs returns JSON 401 when unauthenticated", async ({ request }) => {
  const response = await request.patch("/api/climbs", {
    data: { id: PLACEHOLDER_ID, climbedOn: "2026-01-01" },
  });

  await expectUnauthenticatedJson(response, /\/api\/climbs$/);
});

test("DELETE /api/climbs returns JSON 401 when unauthenticated", async ({ request }) => {
  const response = await request.delete("/api/climbs", {
    data: { id: PLACEHOLDER_ID },
  });

  await expectUnauthenticatedJson(response, /\/api\/climbs$/);
});

test("POST /api/projects returns JSON 401 when unauthenticated", async ({ request }) => {
  const response = await request.post("/api/projects", {
    data: { routeId: "test" },
  });

  await expectUnauthenticatedJson(response, /\/api\/projects$/);
});

test("DELETE /api/projects returns JSON 401 when unauthenticated", async ({ request }) => {
  const response = await request.delete("/api/projects", {
    data: { id: PLACEHOLDER_ID },
  });

  await expectUnauthenticatedJson(response, /\/api\/projects$/);
});
