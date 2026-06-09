import type { APIRoute } from "astro";
import { z } from "zod";
import {
  addProject,
  createPrivateStateClient,
  PrivateStateError,
  type PrivateStateErrorCode,
  removeProject,
} from "@/lib/private-state";
import { getTranslations } from "@/i18n";

/**
 * S-06 projects-mutation endpoint.
 *
 * Single authenticated JSON mutation surface for the personal projects
 * list. The per-route crag toggle (`src/components/projects/ProjectAction.tsx`)
 * posts here to add, and both the crag toggle and the `/projekty` row island
 * delete here. React islands MUST go through this endpoint instead of
 * importing `@/lib/private-state` directly — that module carries the Supabase
 * session cookies and Strapi API token and is server-only by contract (see
 * `src/lib/private-state/index.ts`). This mirrors `src/pages/api/climbs.ts`
 * field-for-field.
 *
 * Contract
 *
 * - `POST` body: `{ routeId: string }` (trimmed, 1–200 chars) where `routeId`
 *   is the Strapi `documentId`.
 *   - Success: `201 Created` with `{ project: UserProject }` so the calling
 *     island can hold the new project row id and support an immediate remove
 *     without a re-fetch.
 *   - `duplicate_project` (422): the route is already on the user's list.
 * - `DELETE` body: `{ id: string }` where `id` is the project row UUID.
 *   - Success: `200 OK` with `{ deleted: { id } }` so the calling island can
 *     reconcile its local row state without a re-fetch.
 *   - `not_found` (404): the row is absent or not owned by the current user.
 *     RLS collapses both cases to one outcome so ownership is never leaked;
 *     the client treats this as an idempotent "already gone".
 * - Failure: `{ error: { code, message, context } }` per the repo's
 *   structured-error rule (`AGENTS.md`). `message` is a Polish user-facing
 *   string drawn from `src/i18n/ui.ts`; raw Supabase / Strapi error text is
 *   kept in `context` for server logs only.
 *
 * `/api/projects` is intentionally NOT in `PROTECTED_ROUTES` so signed-out
 * islands get a structured `401` JSON instead of an HTML redirect.
 */
export const prerender = false;

const addProjectSchema = z.object({
  routeId: z.string().trim().min(1).max(200),
});

const deleteProjectSchema = z.object({
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
      return t("errors.projects.invalid_input");
    case "unauthenticated":
      return t("errors.projects.unauthenticated");
    case "unknown_route":
      return t("errors.projects.unknown_route");
    case "duplicate_project":
      return t("errors.projects.duplicate_project");
    case "missing_config":
      return t("errors.projects.missing_config");
    case "upstream_error":
      return t("errors.projects.upstream_error");
    case "not_found":
      return t("errors.projects.not_found");
    case "unknown":
    default:
      return t("errors.projects.unknown");
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
  // JSON-only contract: the crag-row toggle posts a small `{ routeId }` body
  // via `fetch`. Form-data is not supported on this endpoint.
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return jsonResponse(errorBody("invalid_input", { reason: "body_not_json" }), STATUS_FOR_CODE.invalid_input);
  }

  const parsed = addProjectSchema.safeParse(raw);
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
    const project = await addProject(client, { routeId: parsed.data.routeId });
    return jsonResponse({ project }, 201);
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
  // Same JSON-only contract as POST: the crag-row toggle and `/projekty` row
  // island send a small `{ id }` body via `fetch`. Form-data is not supported.
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return jsonResponse(errorBody("invalid_input", { reason: "body_not_json" }), STATUS_FOR_CODE.invalid_input);
  }

  const parsed = deleteProjectSchema.safeParse(raw);
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
    await removeProject(client, parsed.data.id);
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
