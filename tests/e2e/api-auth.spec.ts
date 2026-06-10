import { expect, test } from "@playwright/test";

test("POST /api/climbs returns JSON 401 when unauthenticated", async ({ request }) => {
  const response = await request.post("/api/climbs", {
    data: { routeId: "test", climbedOn: "2026-01-01" },
  });

  expect(response.status()).toBe(401);
  expect(response.url()).toMatch(/\/api\/climbs$/);

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
});
