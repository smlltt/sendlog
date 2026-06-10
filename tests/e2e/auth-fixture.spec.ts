import { test } from "@playwright/test";
import { E2E_TEST_EMAIL } from "./constants";
import { assertAuthenticated, signInViaMagicLink, signOut } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("signInViaMagicLink establishes session and signOut clears it", async ({ page }) => {
  await signInViaMagicLink(page, { email: E2E_TEST_EMAIL, next: "/dashboard" });
  await assertAuthenticated(page, E2E_TEST_EMAIL);
  await signOut(page);
});
