/**
 * <ProjectsListCard> — the `/projekty` remove-capable projects list island.
 *
 * Boundary
 *
 * - DOES NOT import `@/lib/private-state` (server-only) or `@/lib/catalog`.
 *   The only path back to Supabase is the JSON `DELETE /api/projects`
 *   endpoint, which carries the user's session cookies automatically
 *   through the browser fetch.
 * - DOES import `Pending` from `@/components/ui/Pending` so
 *   `scripts/check-progress.mjs` (`guardrails:progress`) can prove the
 *   >2 s delete mutation shows progress feedback. Do not swap for a plain
 *   spinner without updating
 *   `docs/verification/progress-feedback-actions.md`.
 *
 * Why a list-level island (not one island per row)
 *
 * The island owns the full `projects` array so that removing the last row
 * can fall straight through to the same Polish empty-state the page renders
 * on first load — no refresh required. This mirrors the S-05
 * `HistoryClimbCard` pattern field-for-field. Each row keeps its own
 * two-step confirm / pending / error sub-state; the list owns membership
 * and the shared success / neutral notice.
 *
 * `not_found` handling
 *
 * A 404 with code `not_found` is treated as an idempotent "already gone":
 * the row is removed and a neutral notice is shown rather than a scary
 * failure. RLS collapses "row absent" and "row not owned" into the same
 * outcome, so this never leaks which case happened.
 */

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import Pending from "@/components/ui/Pending";
import { cn } from "@/lib/utils";
import { getTranslations } from "@/i18n";
import type { DeleteProjectResponse, ProjectApiErrorBody, ProjectListItem } from "@/components/projects/types";

interface ProjectsListCardProps {
  projects: ProjectListItem[];
}

type ListNotice = { kind: "success" | "neutral"; text: string } | null;

/** Outcome a row reports back so the list can pick the right notice copy. */
type RemovalOutcome = "deleted" | "already_gone";

export default function ProjectsListCard({ projects }: ProjectsListCardProps) {
  const t = getTranslations();
  const [items, setItems] = useState<ProjectListItem[]>(projects);
  const [notice, setNotice] = useState<ListNotice>(null);

  function handleRemoved(id: string, outcome: RemovalOutcome) {
    setItems((prev) => prev.filter((project) => project.id !== id));
    setNotice(
      outcome === "deleted"
        ? { kind: "success", text: t("projects.remove.success") }
        : { kind: "neutral", text: t("projects.remove.already_gone") },
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {notice ? (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-md border p-3 text-sm",
              notice.kind === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-slate-300 bg-slate-50 text-slate-700",
            )}
          >
            {notice.text}
          </p>
        ) : null}

        <div className="rounded-md border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">{t("projects.empty_heading")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("projects.empty_body")}</p>
          <a
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t("projects.empty_cta")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notice ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-md border p-3 text-sm",
            notice.kind === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-slate-300 bg-slate-50 text-slate-700",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            onRemoved={handleRemoved}
            onActivity={() => {
              setNotice(null);
            }}
          />
        ))}
      </ul>
    </div>
  );
}

interface ProjectRowProps {
  project: ProjectListItem;
  onRemoved: (id: string, outcome: RemovalOutcome) => void;
  /** Called when the user starts interacting so a stale list notice clears. */
  onActivity: () => void;
}

type RowState = "idle" | "confirming" | "deleting";

function ProjectRow({ project, onRemoved, onActivity }: ProjectRowProps) {
  const t = getTranslations();
  const [state, setState] = useState<RowState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setErrorMessage(null);
    setState("deleting");

    let response: Response;
    try {
      response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });
    } catch {
      setErrorMessage(t("projects.action.error_network"));
      setState("confirming");
      return;
    }

    if (response.ok) {
      try {
        (await response.json()) as DeleteProjectResponse;
      } catch {
        // Body shape is advisory only — the id we deleted is already known.
      }
      onRemoved(project.id, "deleted");
      return;
    }

    let body: ProjectApiErrorBody | null = null;
    try {
      body = (await response.json()) as ProjectApiErrorBody;
    } catch {
      // fall through to generic message
    }

    // `not_found` is an idempotent "already gone": drop the row and let the
    // list surface neutral copy rather than a failure.
    if (body?.error.code === "not_found") {
      onRemoved(project.id, "already_gone");
      return;
    }

    setErrorMessage(body?.error.message ?? t("projects.remove.error"));
    setState("confirming");
  }

  return (
    <li className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-slate-900">{project.routeName ?? "—"}</h3>
        {project.routeGrade ? (
          <span className="text-sm text-slate-600">
            <span className="text-slate-500">{t("projects.row.grade_label")}</span> {project.routeGrade}
          </span>
        ) : null}
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-[max-content_1fr]">
        {project.routeType ? (
          <>
            <dt className="text-slate-500">{t("projects.row.type_label")}</dt>
            <dd>{project.routeType}</dd>
          </>
        ) : null}

        <dt className="text-slate-500">{t("projects.row.added_label")}</dt>
        <dd>
          <time dateTime={project.addedOn}>{project.addedOn}</time>
        </dd>

        <dt className="text-slate-500">{t("projects.row.crag_label")}</dt>
        <dd>
          {project.cragHref ? (
            <a href={project.cragHref} className="font-medium text-purple-700 hover:underline">
              {project.cragName ?? t("projects.row.open_crag")}
            </a>
          ) : (
            <span className="text-slate-500">{project.cragName ?? t("projects.row.crag_unavailable")}</span>
          )}
        </dd>
      </dl>

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
        {state === "idle" ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                onActivity();
                setState("confirming");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("projects.remove.button")}
            </button>
          </div>
        ) : null}

        {state === "confirming" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-sm text-slate-700 sm:mr-auto">{t("projects.remove.confirm_prompt")}</span>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setState("idle");
              }}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <X className="size-4" aria-hidden="true" />
              {t("projects.remove.cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-red-300 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("projects.remove.confirm")}
            </button>
          </div>
        ) : null}

        {state === "deleting" ? (
          <div className="flex justify-end">
            <Pending label={t("projects.remove.pending")} size="sm" className="text-slate-600" />
          </div>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </li>
  );
}
