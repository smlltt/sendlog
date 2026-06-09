import { test, expect } from "@playwright/test";

test("sign-in page renders for anonymous visitors", async ({ page }) => {
  await page.goto("/auth/signin");

  await expect(page.getByRole("heading", { name: "Zaloguj się w SendLog" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Wyślij link logowania" })).toBeVisible();
});
