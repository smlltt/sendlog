import type { APIRoute } from "astro";
import { z } from "zod";
import {
  createClimb,
  createPrivateStateClient,
  deleteClimb,
  PrivateStateError,
  type PrivateStateErrorCode,
} from "@/lib/private-state";
import { getTranslations } from "@/i18n";

/**
 * S-04 / S-05 climb-mutation endpoint.
 *
 * Single authenticated JSON mutation surface for climbs. The inline
 * route-row form (`src/components/climbs/ClimbLogForm.tsx`) posts here to
 * create, and the `/historia` row island deletes here. React islands MUST
 * go through this endpoint instead of importing `@/lib/private-state`
 * directly — that module carries the Supabase session cookies and Strapi
 * API token and is server-only by contract (see
 * `src/lib/private-state/index.ts`).
 *
 * Contract
 *
 * - `POST` body: `{ routeId: string; climbedOn: string; note?: string | null }`
 *   where `climbedOn` is a strict `YYYY-MM-DD` UTC date matching the
 *   Postgres `date` column on `public.climbs`.
 *   - Success: `201 Created` with `{ climb: UserClimb }` so the calling
 *     island can update its row summary without a re-fetch.
 * - `DELETE` body: `{ id: string }` where `id` is the climb row UUID.
 *   - Success: `200 OK` with `{ deleted: { id } }` so the calling island
 *     can reconcile its local row state without a re-fetch.
 *   - `not_found` (404): the row is absent or not owned by the current
 *     user. RLS collapses both cases to one outcome so ownership is never
 *     leaked; the client treats this as an idempotent "already gone".
 * - Failure: `{ error: { code, message, context } }` per the repo's
 *   structured-error rule (`AGENTS.md`). `message` is a Polish
 *   user-facing string drawn from `src/i18n/ui.ts`; raw Supabase /
 *   Strapi error text is kept in `context` for server logs only and is
 *   not surfaced to the user. `code` is the stable identifier the
 *   client uses to switch on retry vs sign-in behavior.
 *
 * Status codes mirror the error code:
 *
 * - `invalid_input` → 400
 * - `unauthenticated` → 401 (signed-out clients; middleware does NOT
 *   gate `/api/climbs` because we still want to return a structured
 *   401 JSON instead of an HTML redirect for the React island).
 * - `unknown_route` → 422 (valid shape, but the catalog has no matching
 *   route — the form can't recover this client-side).
 * - `not_found` → 404 (delete target absent or not owned).
 * - `missing_config` → 503 (server misconfiguration, transient).
 * - `upstream_error` / `unknown` → 500.
 */
export const prerender = false;

const NOTE_MAX_LENGTH = 2000;

const climbSchema = z.object({
  routeId: z.string().trim().min(1).max(200),
  climbedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "climbedOn must be a YYYY-MM-DD UTC date"),
  note: z.string().max(NOTE_MAX_LENGTH).nullish(),
});

const deleteClimbSchema = z.object({
  id: z.uuid(),
});

type ApiErrorCode = "invalid_input" | "unknown" | PrivateStateErrorCode;

interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    context: Record<string, unknown>;
  };
}

const STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  unauthenticated: 401,
  unknown_route: 422,
  duplicate_project: 422,
  not_found: 404,
  missing_config: 503,
  upstream_error: 500,
  unknown: 500,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function resolveErrorMessage(code: ApiErrorCode): string {
  const t = getTranslations();
  switch (code) {
    case "invalid_input":
      return t("errors.climbs.invalid_input");
    case "unauthenticated":
      return t("errors.climbs.unauthenticated");
    case "unknown_route":
      return t("errors.climbs.unknown_route");
    case "missing_config":
      return t("errors.climbs.missing_config");
    case "upstream_error":
      return t("errors.climbs.upstream_error");
    case "not_found":
      return t("errors.climbs.not_found");
    // `duplicate_project` cannot be produced by `createClimb` or
    // `deleteClimb`; it's handled here for completeness so future endpoints
    // that share the helper get the same Polish phrasing fallback.
    case "duplicate_project":
    case "unknown":
    default:
      return t("errors.climbs.unknown");
  }
}

function errorBody(code: ApiErrorCode, context: Record<string, unknown> = {}): ApiErrorBody {
  return {
    error: {
      code,
      message: resolveErrorMessage(code),
      context,
    },
  };
}

export const POST: APIRoute = async (context) => {
  // Read the JSON body up front. We accept and require `application/json`;
  // the inline form posts via `fetch`. Form-data is not supported on this
  // endpoint because it would invite a different validation surface.
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return jsonResponse(errorBody("invalid_input", { reason: "body_not_json" }), STATUS_FOR_CODE.invalid_input);
  }

  const parsed = climbSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      errorBody("invalid_input", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      }),
      STATUS_FOR_CODE.invalid_input,
    );
  }

  let client;
  try {
    client = createPrivateStateClient(context.request.headers, context.cookies, context.locals.user);
  } catch (err) {
    if (err instanceof PrivateStateError) {
      return jsonResponse(errorBody(err.code, err.context), STATUS_FOR_CODE[err.code]);
    }
    return jsonResponse(
      errorBody("unknown", { detail: err instanceof Error ? err.message : String(err) }),
      STATUS_FOR_CODE.unknown,
    );
  }

  try {
    const climb = await createClimb(client, {
      routeId: parsed.data.routeId,
      climbedOn: parsed.data.climbedOn,
      note: parsed.data.note ?? null,
    });
    return jsonResponse({ climb }, 201);
  } catch (err) {
    if (err instanceof PrivateStateError) {
      return jsonResponse(errorBody(err.code, err.context), STATUS_FOR_CODE[err.code]);
    }
    return jsonResponse(
      errorBody("unknown", { detail: err instanceof Error ? err.message : String(err) }),
      STATUS_FOR_CODE.unknown,
    );
  }
};

export const DELETE: APIRoute = async (context) => {
  // Same JSON-only contract as POST: the `/historia` row island sends a
  // small `{ id }` body via `fetch`. Form-data is not supported.
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return jsonResponse(errorBody("invalid_input", { reason: "body_not_json" }), STATUS_FOR_CODE.invalid_input);
  }

  const parsed = deleteClimbSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      errorBody("invalid_input", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      }),
      STATUS_FOR_CODE.invalid_input,
    );
  }

  let client;
  try {
    client = createPrivateStateClient(context.request.headers, context.cookies, context.locals.user);
  } catch (err) {
    if (err instanceof PrivateStateError) {
      return jsonResponse(errorBody(err.code, err.context), STATUS_FOR_CODE[err.code]);
    }
    return jsonResponse(
      errorBody("unknown", { detail: err instanceof Error ? err.message : String(err) }),
      STATUS_FOR_CODE.unknown,
    );
  }

  try {
    await deleteClimb(client, parsed.data.id);
    // Echo the deleted id so the island can reconcile its local row state
    // without a re-fetch.
    return jsonResponse({ deleted: { id: parsed.data.id } }, 200);
  } catch (err) {
    if (err instanceof PrivateStateError) {
      return jsonResponse(errorBody(err.code, err.context), STATUS_FOR_CODE[err.code]);
    }
    return jsonResponse(
      errorBody("unknown", { detail: err instanceof Error ? err.message : String(err) }),
      STATUS_FOR_CODE.unknown,
    );
  }
};
