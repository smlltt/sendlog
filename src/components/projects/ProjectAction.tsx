/**
 * <ProjectAction> — the signed-in per-route projects toggle inside the crag
 * route table.
 *
 * Two membership states feed into one island so the route row never
 * navigates away when toggling:
 *
 * - Off-list (`projectId === null`): a "Dodaj do projektów" button that
 *   `POST`s `{ routeId }`. On `201` it stores the returned project `id` and
 *   flips to the on-list state, so an immediate remove works without a
 *   re-fetch (same no-re-render-during-session assumption as
 *   `RouteClimbAction`).
 * - On-list (`projectId !== null`): a "W projektach" indicator plus an inline
 *   two-step remove that `DELETE`s `{ id }` (S-05 confirm → pending pattern).
 *   `not_found` (404) is treated as an idempotent "already gone" and still
 *   flips back to off-list.
 *
 * Boundary
 *
 * - DOES NOT import `@/lib/private-state` (server-only). The only path back to
 *   Supabase is the JSON `POST` / `DELETE /api/projects` endpoint, which
 *   carries the user's session cookies automatically through the browser
 *   fetch.
 * - DOES import `Pending` from `@/components/ui/Pending` so
 *   `scripts/check-progress.mjs` (`guardrails:progress`) can prove the >2 s
 *   add / remove mutations show progress feedback. Do not swap for a plain
 *   spinner without updating `docs/verification/progress-feedback-actions.md`.
 *
 * The component receives `initialProjectId` from the server-side membership
 * map built in `src/pages/regiony/[region]/[crag].astro`
 * (`listProjects(client)` → `routeId → project.id`), keeps its own copy in
 * state, and updates it on add / remove.
 */

import { useState } from "react";
import { FolderPlus, Trash2, X } from "lucide-react";
import Pending from "@/components/ui/Pending";
import { getTranslations } from "@/i18n";
import type { AddProjectResponse, ProjectApiErrorBody } from "@/components/projects/types";

interface ProjectActionProps {
  routeId: string;
  /** Project row id when the route is already on the list, else `null`. */
  initialProjectId: string | null;
}

type RemoveState = "idle" | "confirming" | "deleting";

export default function ProjectAction({ routeId, initialProjectId }: ProjectActionProps) {
  const t = getTranslations();
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [isAdding, setIsAdding] = useState(false);
  const [removeState, setRemoveState] = useState<RemoveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState(false);

  async function handleAdd() {
    setErrorMessage(null);
    setIsAdding(true);

    let response: Response;
    try {
      response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
    } catch {
      setErrorMessage(t("projects.action.error_network"));
      setIsAdding(false);
      return;
    }

    if (response.ok) {
      let body: AddProjectResponse | null = null;
      try {
        body = (await response.json()) as AddProjectResponse;
      } catch {
        // Body shape is advisory; fall through to the unknown-error path below.
      }
      if (body?.project.id) {
        setProjectId(body.project.id);
        setRecentlyAdded(true);
        setIsAdding(false);
        return;
      }
      setErrorMessage(t("errors.projects.unknown"));
      setIsAdding(false);
      return;
    }

    let errorBody: ProjectApiErrorBody | null = null;
    try {
      errorBody = (await response.json()) as ProjectApiErrorBody;
    } catch {
      // fall through to generic message
    }
    setErrorMessage(errorBody?.error.message ?? t("errors.projects.unknown"));
    setIsAdding(false);
  }

  async function handleConfirmRemove() {
    if (projectId === null) return;
    setErrorMessage(null);
    setRemoveState("deleting");

    let response: Response;
    try {
      response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId }),
      });
    } catch {
      setErrorMessage(t("projects.action.error_network"));
      setRemoveState("confirming");
      return;
    }

    if (response.ok) {
      setProjectId(null);
      setRecentlyAdded(false);
      setRemoveState("idle");
      return;
    }

    let body: ProjectApiErrorBody | null = null;
    try {
      body = (await response.json()) as ProjectApiErrorBody;
    } catch {
      // fall through to generic message
    }

    // `not_found` is an idempotent "already gone": flip back to off-list
    // rather than surfacing a scary failure.
    if (body?.error.code === "not_found") {
      setProjectId(null);
      setRecentlyAdded(false);
      setRemoveState("idle");
      return;
    }

    setErrorMessage(body?.error.message ?? t("projects.remove.error"));
    setRemoveState("confirming");
  }

  return (
    <div className="flex flex-col gap-2">
      {projectId === null ? (
        <div className="flex flex-wrap items-center gap-2">
          {isAdding ? (
            <Pending label={t("projects.action.add_pending")} size="sm" className="text-slate-600" />
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
            >
              <FolderPlus className="size-3" aria-hidden="true" />
              {t("projects.action.add_button")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {t("projects.action.on_list")}
            </span>
            {recentlyAdded && removeState === "idle" ? (
              <span className="text-xs text-emerald-700" aria-live="polite">
                {t("projects.action.added")}
              </span>
            ) : null}
          </div>

          {removeState === "idle" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setRecentlyAdded(false);
                  setRemoveState("confirming");
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Trash2 className="size-3" aria-hidden="true" />
                {t("projects.remove.button")}
              </button>
            </div>
          ) : null}

          {removeState === "confirming" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-700">{t("projects.remove.confirm_prompt")}</span>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setRemoveState("idle");
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <X className="size-3" aria-hidden="true" />
                {t("projects.remove.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
              >
                <Trash2 className="size-3" aria-hidden="true" />
                {t("projects.remove.confirm")}
              </button>
            </div>
          ) : null}

          {removeState === "deleting" ? (
            <Pending label={t("projects.remove.pending")} size="sm" className="text-slate-600" />
          ) : null}
        </div>
      )}

      {errorMessage ? (
        <p role="alert" className="text-xs text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
