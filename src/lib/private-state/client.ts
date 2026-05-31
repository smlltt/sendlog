import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { PrivateStateError } from "@/lib/private-state/types";

/**
 * Narrow request-scoped Supabase client paired with the resolved authenticated
 * user id. Built once per request by `createPrivateStateClient` and threaded
 * into every helper in `climbs.ts` / `projects.ts`. The wrapper guarantees
 * downstream helpers see a non-null `userId: string` — the "no anonymous
 * writes" invariant promised by F-02.
 */
export interface PrivateStateClient {
  supabase: NonNullable<ReturnType<typeof createClient>>;
  userId: string;
}

/**
 * Build a `PrivateStateClient` for the current request.
 *
 * - `user === null` → throws `PrivateStateError("unauthenticated")`.
 * - `createClient(...)` returns `null` (Supabase env unset) → throws
 *   `PrivateStateError("missing_config")`.
 *
 * The wrapper does not query Supabase itself — middleware (`src/middleware.ts`)
 * has already resolved `Astro.locals.user`. It only narrows types and refuses
 * to proceed without an identity. RLS is the second line of defense for
 * privacy; this is the first one inside the app.
 */
export function createPrivateStateClient(
  requestHeaders: Headers,
  cookies: AstroCookies,
  user: User | null,
): PrivateStateClient {
  if (!user) {
    throw new PrivateStateError("unauthenticated", "Brak uwierzytelnionego użytkownika.");
  }
  const supabase = createClient(requestHeaders, cookies);
  if (!supabase) {
    throw new PrivateStateError("missing_config", "Supabase nie jest skonfigurowane.", {
      hint: "SUPABASE_URL or SUPABASE_KEY missing",
    });
  }
  return { supabase, userId: user.id };
}
