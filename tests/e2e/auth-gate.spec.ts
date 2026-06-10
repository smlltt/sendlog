import { expect, test } from "@playwright/test";

/** Distinct from `E2E_TEST_EMAIL` so parallel mailbox specs do not race on Inbucket. */
const E2E_GATE_EMAIL = "e2e-gate@example.com";

test.describe("anonymous auth gate", () => {
  test("anonymous user is redirected from /dashboard to sign-in with next", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL("/auth/signin?next=%2Fdashboard");
    await expect(page.getByRole("heading", { name: "Zaloguj się w SendLog" })).toBeVisible();
  });

  test("magic-link form submits and shows check-email", async ({ page }) => {
    await page.goto("/auth/signin");

    const emailField = page.getByLabel("Email");
    await expect(emailField).toBeVisible();
    await emailField.fill(E2E_GATE_EMAIL);
    await expect(emailField).toHaveValue(E2E_GATE_EMAIL);

    await page.getByRole("button", { name: "Wyślij link logowania" }).click();

    await expect(page).toHaveURL(/\/auth\/check-email/);
    await expect(page.getByRole("heading", { name: "Sprawdź swoją skrzynkę" })).toBeVisible();
  });
});
