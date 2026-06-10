import { expect, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL } from "../constants";
import { clearMailbox, waitForMagicLink } from "./inbucket";

export interface SignInViaMagicLinkOptions {
  email?: string;
  next?: string;
}

function signInPath(next?: string): string {
  if (!next) {
    return "/auth/signin";
  }

  return `/auth/signin?next=${encodeURIComponent(next)}`;
}

function expectedLandingPath(next?: string): string | RegExp {
  if (next) {
    return next;
  }

  return "/dashboard";
}

/** Full passwordless sign-in: form → Mailpit → `/auth/confirm` → gated landing. */
export async function signInViaMagicLink(page: Page, options?: SignInViaMagicLinkOptions): Promise<void> {
  const email = options?.email ?? E2E_TEST_EMAIL;
  const next = options?.next;

  await clearMailbox(email);
  await page.goto(signInPath(next));

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Wyślij link logowania" }).click();

  await expect(page).toHaveURL(/\/auth\/check-email/);
  await expect(page.getByRole("heading", { name: "Sprawdź swoją skrzynkę" })).toBeVisible();

  const confirmUrl = await waitForMagicLink(email);
  await page.goto(confirmUrl);

  await expect(page).toHaveURL(expectedLandingPath(next));
}

/** Assert dashboard session UI and Supabase SSR auth cookies. */
export async function assertAuthenticated(page: Page, email: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Panel", level: 1 })).toBeVisible();
  await expect(page.getByText(`Witaj, ${email}`)).toBeVisible();
  // The dashboard renders a sign-out control in both the header banner and main; scope to main.
  await expect(page.getByRole("main").getByRole("button", { name: "Wyloguj" })).toBeVisible();

  const cookies = await page.context().cookies();
  const authCookie = cookies.find((cookie) => cookie.name.includes("-auth-token"));
  expect(authCookie, "expected Supabase sb-*-auth-token cookie after confirm").toBeDefined();
}

/** Click dashboard sign-out and wait for anonymous catalog header. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("main").getByRole("button", { name: "Wyloguj" }).click();
  await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
}
