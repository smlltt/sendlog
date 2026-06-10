import { expect, test, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL } from "./constants";
import { assertAuthenticated, signInViaMagicLink, signOut } from "./helpers";

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  await context.clearCookies();
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

test("magic-link confirm establishes session on dashboard", async () => {
  await signInViaMagicLink(page, { email: E2E_TEST_EMAIL, next: "/dashboard" });
  await assertAuthenticated(page, E2E_TEST_EMAIL);
});

test("middleware honors session on another gated page", async () => {
  await page.goto("/historia");

  await expect(page).toHaveURL("/historia");
  await expect(page).not.toHaveURL(/\/auth\/signin/);
  await expect(page.getByRole("heading", { name: "Historia przejść", level: 1 })).toBeVisible();
});

test("sign-out clears gated access", async () => {
  await page.goto("/dashboard");
  await assertAuthenticated(page, E2E_TEST_EMAIL);

  await signOut(page);

  await page.goto("/dashboard");

  await expect(page).toHaveURL("/auth/signin?next=%2Fdashboard");
  await expect(page.getByRole("heading", { name: "Zaloguj się w SendLog" })).toBeVisible();
});
