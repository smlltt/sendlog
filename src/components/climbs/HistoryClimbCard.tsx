/**
 * <HistoryClimbCard> — the `/historia` edit- and delete-capable history
 * list island.
 *
 * Boundary
 *
 * - DOES NOT import `@/lib/private-state` (server-only) or `@/lib/catalog`.
 *   The only paths back to Supabase are the JSON `DELETE /api/climbs`
 *   endpoint (delete) and `<ClimbLogForm mode="edit">`'s `PATCH
 *   /api/climbs` (edit) — both carry the user's session cookies
 *   automatically through the browser fetch. `ClimbLogForm` is itself a
 *   client island and keeps the server-only boundary intact.
 * - DOES import `Pending` from `@/components/ui/Pending` so
 *   `scripts/check-progress.mjs` (`guardrails:progress`) can prove the
 *   >2 s delete mutation shows progress feedback. Do not swap for a plain
 *   spinner without updating
 *   `docs/verification/progress-feedback-actions.md`.
 *
 * Edit lifecycle
 *
 * Each row carries an `editing` sub-state that mounts `ClimbLogForm` in
 * edit mode. On save the list (not the row) reconciles the edited values
 * via `handleUpdated` so the collapsed row re-renders from one source of
 * truth; a `not_found` reuses the delete `already_gone` path so a stale
 * row drops out with the shared neutral notice.
 *
 * Why a list-level island (not one island per row)
 *
 * The island owns the full `items` array so that deleting the last row can
 * fall straight through to the same Polish empty-state the page renders on
 * first load — no refresh required. This is the plan's recommended
 * "list-level state" path (S-05, Phase 2 §4). Each row keeps its own
 * two-step confirm / pending / error sub-state; the list owns membership
 * and the shared success / neutral notice.
 *
 * `not_found` handling
 *
 * A 404 with code `not_found` is treated as an idempotent "already gone":
 * the row is removed and a neutral notice is shown rather than a scary
 * failure. RLS collapses "row absent" and "row not owned" into the same
 * outcome, so this never leaks which case happened.
 *
 * The component calls `getTranslations()` directly (same pattern as
 * `ClimbLogForm` / `RouteClimbAction`) — the i18n dictionary is a static,
 * client-safe module, so labels are not threaded through as props.
 */

import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import ClimbLogForm from "@/components/climbs/ClimbLogForm";
import Pending from "@/components/ui/Pending";
import { cn } from "@/lib/utils";
import { getTranslations } from "@/i18n";
import type { ClimbApiErrorBody, DeleteClimbResponse, HistoryClimbItem } from "@/components/climbs/types";

interface HistoryClimbCardProps {
  climbs: HistoryClimbItem[];
}

type ListNotice = { kind: "success" | "neutral"; text: string } | null;

/** Outcome a row reports back so the list can pick the right notice copy. */
type RemovalOutcome = "deleted" | "already_gone";

export default function HistoryClimbCard({ climbs }: HistoryClimbCardProps) {
  const t = getTranslations();
  const [items, setItems] = useState<HistoryClimbItem[]>(climbs);
  const [notice, setNotice] = useState<ListNotice>(null);

  function handleRemoved(id: string, outcome: RemovalOutcome) {
    setItems((prev) => prev.filter((climb) => climb.id !== id));
    setNotice(
      outcome === "deleted"
        ? { kind: "success", text: t("history.delete.success") }
        : { kind: "neutral", text: t("history.delete.already_gone") },
    );
  }

  // The list owns the edited values (not the row) so the collapsed row
  // re-renders from a single source of truth, mirroring how delete owns
  // membership at the list level.
  function handleUpdated(id: string, patch: { climbedOn: string; note: string | null }) {
    setItems((prev) => prev.map((climb) => (climb.id === id ? { ...climb, ...patch } : climb)));
    setNotice({ kind: "success", text: t("history.edit.success") });
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
          <h2 className="text-lg font-semibold text-slate-900">{t("history.empty_heading")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("history.empty_body")}</p>
          <a
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t("history.empty_cta")}
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
        {items.map((climb) => (
          <ClimbRow
            key={climb.id}
            climb={climb}
            onRemoved={handleRemoved}
            onUpdated={handleUpdated}
            onActivity={() => {
              setNotice(null);
            }}
          />
        ))}
      </ul>
    </div>
  );
}

interface ClimbRowProps {
  climb: HistoryClimbItem;
  onRemoved: (id: string, outcome: RemovalOutcome) => void;
  onUpdated: (id: string, patch: { climbedOn: string; note: string | null }) => void;
  /** Called when the user starts interacting so a stale list notice clears. */
  onActivity: () => void;
}

type RowState = "idle" | "confirming" | "deleting" | "editing";

function ClimbRow({ climb, onRemoved, onUpdated, onActivity }: ClimbRowProps) {
  const t = getTranslations();
  const [state, setState] = useState<RowState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setErrorMessage(null);
    setState("deleting");

    let response: Response;
    try {
      response = await fetch("/api/climbs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: climb.id }),
      });
    } catch {
      setErrorMessage(t("history.delete.error_network"));
      setState("confirming");
      return;
    }

    if (response.ok) {
      try {
        (await response.json()) as DeleteClimbResponse;
      } catch {
        // Body shape is advisory only — the id we deleted is already known.
      }
      onRemoved(climb.id, "deleted");
      return;
    }

    let body: ClimbApiErrorBody | null = null;
    try {
      body = (await response.json()) as ClimbApiErrorBody;
    } catch {
      // fall through to generic message
    }

    // `not_found` is an idempotent "already gone": drop the row and let the
    // list surface neutral copy rather than a failure.
    if (body?.error.code === "not_found") {
      onRemoved(climb.id, "already_gone");
      return;
    }

    setErrorMessage(body?.error.message ?? t("history.delete.error"));
    setState("confirming");
  }

  return (
    <li className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-slate-900">{climb.routeName ?? "—"}</h3>
        {climb.routeGrade ? (
          <span className="text-sm text-slate-600">
            <span className="text-slate-500">{t("history.row.grade_label")}</span> {climb.routeGrade}
          </span>
        ) : null}
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-[max-content_1fr]">
        <dt className="text-slate-500">{t("history.row.date_label")}</dt>
        <dd>
          <time dateTime={climb.climbedOn}>{climb.climbedOn}</time>
        </dd>

        <dt className="text-slate-500">{t("history.row.crag_label")}</dt>
        <dd>
          {climb.cragHref ? (
            <a href={climb.cragHref} className="font-medium text-purple-700 hover:underline">
              {climb.cragName ?? t("history.row.open_crag")}
            </a>
          ) : (
            <span className="text-slate-500">{climb.cragName ?? t("history.row.crag_unavailable")}</span>
          )}
        </dd>

        {climb.note ? (
          <>
            <dt className="text-slate-500">{t("history.row.note_label")}</dt>
            <dd className="break-words whitespace-pre-wrap">{climb.note}</dd>
          </>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
        {state === "idle" ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onActivity();
                setState("editing");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Pencil className="size-4" aria-hidden="true" />
              {t("history.edit.button")}
            </button>
            <button
              type="button"
              onClick={() => {
                onActivity();
                setState("confirming");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("history.delete.button")}
            </button>
          </div>
        ) : null}

        {state === "editing" ? (
          <div>
            <h4 className="text-sm font-medium text-slate-700">{t("climbs.form.edit_heading")}</h4>
            <ClimbLogForm
              mode="edit"
              climbId={climb.id}
              initialClimbedOn={climb.climbedOn}
              initialNote={climb.note}
              onSaved={(updated) => {
                onUpdated(climb.id, { climbedOn: updated.climbedOn, note: updated.note });
                setState("idle");
              }}
              onGone={() => {
                onRemoved(climb.id, "already_gone");
              }}
              onCancel={() => {
                setState("idle");
              }}
            />
          </div>
        ) : null}

        {state === "confirming" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-sm text-slate-700 sm:mr-auto">{t("history.delete.confirm_prompt")}</span>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setState("idle");
              }}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <X className="size-4" aria-hidden="true" />
              {t("history.delete.cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-red-300 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("history.delete.confirm")}
            </button>
          </div>
        ) : null}

        {state === "deleting" ? (
          <div className="flex justify-end">
            <Pending label={t("history.delete.pending")} size="sm" className="text-slate-600" />
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
