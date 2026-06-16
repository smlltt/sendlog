import { expect, test } from "@playwright/test";
import {
  FIXTURE_CRAG_NAME,
  FIXTURE_CRAG_PATH,
  FIXTURE_REGION_NAME,
  FIXTURE_REGION_PATH,
  FIXTURE_ROUTE_GRADE,
  FIXTURE_ROUTE_NAME,
  FIXTURE_ROUTE_TYPE,
  FIXTURE_ROUTE_YEAR,
} from "./constants";

/**
 * public-catalog-map.spec.ts — Phase 3 of the test rollout.
 *
 * Protects two `context/foundation/test-plan.md` risks in one anonymous spec:
 *
 *   - Risk #5 ("public map pins/navigation"): an anonymous visitor can browse
 *     the homepage, reach a region page, and use the interactive map marker
 *     popup to navigate to the seeded crag's route list.
 *   - Risk #6 ("catalog route-list fidelity"): the seeded crag route table
 *     renders the expected name, grade, type, and year — compared against the
 *     independent fixture oracle in `./constants`, never against data fetched
 *     through the app's own Strapi client during the test.
 *
 * Conventions (same five as `seed.spec.ts`): accessible locators first,
 * state-based waits (never `waitForTimeout`), independently runnable, no data
 * created (so no cleanup), and risk-named tests.
 *
 * This spec is intentionally anonymous: it never calls `signInViaMagicLink`,
 * creates no private rows, and needs no cleanup. The only non-accessible hook
 * it relies on is the Phase 1 marker contract in `CragMap.tsx`, which exposes
 * each crag pin's name as the marker button's accessible name.
 *
 * Local prerequisites: the dev server (started by `playwright.config.ts`) plus
 * a seeded Strapi catalog containing `FIXTURE_CRAG_PATH` / `FIXTURE_ROUTE_NAME`
 * and the region/crag display names in `./constants`. See test-plan §6.4.
 */

test.describe("public catalog and map (anonymous)", () => {
  test("anonymous visitor browses the public homepage without signing in (risk #5)", async ({ page }) => {
    await page.goto("/");

    // The SendLog hero, the map CTA, and the map section all render for an
    // anonymous visitor — no redirect to /auth/signin.
    await expect(page.getByRole("heading", { name: "SendLog", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zobacz skały na mapie" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skały", exact: true })).toBeVisible();

    // The header offers sign-in (anonymous), it does not force it.
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("anonymous visitor browses a region page to the seeded crag (risk #5)", async ({ page }) => {
    await page.goto(FIXTURE_REGION_PATH);

    await expect(page.getByRole("heading", { name: FIXTURE_REGION_NAME, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skały w tym rejonie" })).toBeVisible();

    // The region lists the seeded crag as a card link pointing at its page.
    const cragLink = page.getByRole("link", { name: FIXTURE_CRAG_NAME });
    await expect(cragLink).toBeVisible();
    await expect(cragLink).toHaveAttribute("href", FIXTURE_CRAG_PATH);
  });

  test("seeded crag route table renders expected name, grade, type, and year (risk #6)", async ({ page }) => {
    await page.goto(FIXTURE_CRAG_PATH);

    // The crag page is public: visiting it does not redirect to sign-in.
    await expect(page).toHaveURL(new RegExp(`${FIXTURE_CRAG_PATH}$`));
    await expect(page.getByRole("heading", { name: FIXTURE_CRAG_NAME, level: 1 })).toBeVisible();
    await expect(page.getByText(/Współrzędne/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trasy" })).toBeVisible();

    // Route-list fidelity: every field is compared to the independent fixture
    // oracle, so a silent field-drop or transform regression fails here.
    const routeRow = page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") });
    await expect(routeRow).toBeVisible();
    await expect(routeRow.getByRole("cell", { name: FIXTURE_ROUTE_NAME, exact: true })).toBeVisible();
    await expect(routeRow.getByRole("cell", { name: FIXTURE_ROUTE_GRADE, exact: true })).toBeVisible();
    await expect(routeRow.getByRole("cell", { name: FIXTURE_ROUTE_TYPE, exact: true })).toBeVisible();
    await expect(routeRow.getByRole("cell", { name: FIXTURE_ROUTE_YEAR, exact: true })).toBeVisible();
  });

  test("homepage map marker popup navigates to the seeded crag route list (risk #5)", async ({ page }) => {
    await page.goto("/");

    // The map is a `client:only="react"` Leaflet island. Wait for it to hydrate
    // via Leaflet's built-in zoom control (an accessible button) before driving
    // any marker interaction — a state-based wait, never a fixed sleep.
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    await expect(zoomIn).toBeVisible({ timeout: 15_000 });

    // The seeded marker exposes the crag name as its accessible button name
    // (Phase 1 hook). The popup's `Otwórz trasy` link carries `FIXTURE_CRAG_PATH`.
    const marker = page.getByRole("button", { name: FIXTURE_CRAG_NAME });
    const openRoutesLink = page.getByRole("link", { name: "Otwórz trasy" });

    // Open the marker popup with a state-based retry. If the seeded marker is
    // clustered with co-located crags, zoom in (accessible control) to expand
    // the cluster; otherwise click the marker. Either way, the popup link is
    // the success signal — no cluster internals, panes, or CSS selectors.
    await expect(async () => {
      if (await marker.isVisible()) {
        await marker.click();
      } else {
        await zoomIn.click();
      }
      await expect(openRoutesLink).toBeVisible({ timeout: 1_000 });
    }).toPass();

    await openRoutesLink.click();

    // The real marker -> popup -> route-list navigation lands on the seeded crag.
    await expect(page).toHaveURL(new RegExp(`${FIXTURE_CRAG_PATH}$`));
    await expect(page.getByRole("row", { name: new RegExp(FIXTURE_ROUTE_NAME, "i") })).toBeVisible();
  });
});
