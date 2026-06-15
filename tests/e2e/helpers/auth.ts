import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL } from "../constants";
import { clearMailbox, waitForMagicLink } from "./inbucket";

export interface SignInViaMagicLinkOptions {
  email?: string;
  next?: string;
}

export interface CreateAuthenticatedContextOptions {
  email?: string;
  next?: string;
}

export interface AuthenticatedContext {
  context: BrowserContext;
  page: Page;
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

  const emailField = page.getByLabel("Email");
  await expect(emailField).toBeVisible();
  // `MagicLinkForm` is a `client:load` island — retry the whole fill+submit
  // sequence so a hydration remount cannot wipe the value between the two.
  await expect(async () => {
    await emailField.fill(email);
    await expect(emailField).toHaveValue(email);
    await page.getByRole("button", { name: "Wyślij link logowania" }).click();
    await expect(page).toHaveURL(/\/auth\/check-email/, { timeout: 1_000 });
  }).toPass();

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

/**
 * Spin up an isolated browser context with its own cookie jar and complete a
 * full magic-link sign-in inside it. Used by isolation specs that need two
 * concurrent authenticated sessions (user A + user B) without sign-in/out
 * churn on a single shared context. Caller owns the returned `context` and must
 * `close()` it (typically in `afterAll`).
 */
export async function createAuthenticatedContext(
  browser: Browser,
  options?: CreateAuthenticatedContextOptions,
): Promise<AuthenticatedContext> {
  const context = await browser.newContext();
  // Fresh context starts cookie-free, but clear defensively so a reused
  // browser process can never leak a prior session into this user's jar.
  await context.clearCookies();
  const page = await context.newPage();
  await signInViaMagicLink(page, { email: options?.email, next: options?.next });
  return { context, page };
}

/**
 * The page's request context inherits the page's session cookies, so API
 * mutations issued through it run as the signed-in user. Isolation specs use
 * this to have user B attack user A's row ids through the real app endpoints.
 */
export function getAuthenticatedRequest(page: Page): APIRequestContext {
  return page.request;
}
