/**
 * <ClimbLogForm> — the inline React island used inside a signed-in route
 * row to log one new climb.
 *
 * Boundary
 *
 * - DOES NOT import `@/lib/private-state` (server-only). The only path
 *   back to Supabase is the JSON `POST /api/climbs` endpoint, which
 *   carries the user's session cookies automatically through the
 *   browser fetch.
 * - DOES import `SubmitButton` so `scripts/check-progress.mjs`
 *   (`guardrails:progress`) can prove the >2 s save action shows
 *   progress feedback. Do not swap for a plain `<button>` without
 *   updating `docs/verification/progress-feedback-actions.md`.
 *
 * State
 *
 * - Owns `climbedOn`, `note`, validation errors, pending flag, and the
 *   last server error. On 201, it calls `onSaved(climb)` so the parent
 *   row (`<RouteClimbAction>`) can flip its indicator without a page
 *   navigation.
 * - Date defaults are passed in as `defaultClimbedOn` (computed by the
 *   parent via `formatDate(new Date())` — keeping the UTC date helper
 *   server-side avoids drift between server-render and hydration).
 */

import { useState } from "react";
import { Check } from "lucide-react";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { cn } from "@/lib/utils";
import { getTranslations } from "@/i18n";
import type { ClimbApiErrorBody, ClimbResponse } from "@/components/climbs/types";

interface ClimbLogFormProps {
  routeId: string;
  defaultClimbedOn: string;
  onSaved: (climb: ClimbResponse) => void;
  onCancel?: () => void;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function ClimbLogForm({ routeId, defaultClimbedOn, onSaved, onCancel }: ClimbLogFormProps) {
  const t = getTranslations();
  const [climbedOn, setClimbedOn] = useState<string>(defaultClimbedOn);
  const [note, setNote] = useState<string>("");
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    if (climbedOn.trim().length === 0) {
      setDateError(t("climbs.form.error_date_required"));
      return false;
    }
    if (!DATE_PATTERN.test(climbedOn)) {
      setDateError(t("climbs.form.error_date_invalid"));
      return false;
    }
    setDateError(undefined);
    return true;
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setServerMessage(null);
    setIsSubmitting(true);

    let response: Response;
    try {
      response = await fetch("/api/climbs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          climbedOn,
          note: note.trim().length > 0 ? note.trim() : null,
        }),
      });
    } catch {
      setServerMessage(t("climbs.form.error_network"));
      setIsSubmitting(false);
      return;
    }

    if (response.ok) {
      let body: { climb?: ClimbResponse };
      try {
        body = (await response.json()) as { climb?: ClimbResponse };
      } catch {
        setServerMessage(t("errors.climbs.unknown"));
        setIsSubmitting(false);
        return;
      }
      if (body.climb) {
        onSaved(body.climb);
        setNote("");
        setIsSubmitting(false);
        return;
      }
      setServerMessage(t("errors.climbs.unknown"));
      setIsSubmitting(false);
      return;
    }

    let errorBody: ClimbApiErrorBody | null = null;
    try {
      errorBody = (await response.json()) as ClimbApiErrorBody;
    } catch {
      // fall through to generic message
    }
    setServerMessage(errorBody?.error.message ?? t("errors.climbs.unknown"));
    setIsSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`climb-date-${routeId}`} className="mb-1 block text-xs font-medium text-slate-700">
            {t("climbs.form.date_label")}
          </label>
          <input
            id={`climb-date-${routeId}`}
            name="climbedOn"
            type="date"
            value={climbedOn}
            onChange={(e) => {
              setClimbedOn(e.target.value);
              if (dateError) setDateError(undefined);
            }}
            className={cn(
              "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-purple-400 focus:outline-none",
              dateError ? "border-red-400" : "border-slate-300",
            )}
          />
          {dateError ? <p className="mt-1 text-xs text-red-600">{dateError}</p> : null}
        </div>

        <div>
          <label htmlFor={`climb-note-${routeId}`} className="mb-1 block text-xs font-medium text-slate-700">
            {t("climbs.form.note_label")}
          </label>
          <input
            id={`climb-note-${routeId}`}
            name="note"
            type="text"
            maxLength={2000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
            placeholder={t("climbs.form.note_placeholder")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
        </div>
      </div>

      {/*
        Action row sits on its own line under the inputs so it never
        collides with the note column on desktop and never overflows the
        card on mobile. SubmitButton's default `w-full` is overridden
        to content-width via `className="w-auto"`; tailwind-merge keeps
        the override deterministic.
      */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {t("climbs.action.collapse")}
          </button>
        ) : null}
        <SubmitButton
          pending={isSubmitting}
          pendingText={t("climbs.form.submit_pending")}
          icon={<Check className="size-4" />}
          className="w-auto"
        >
          {t("climbs.form.submit")}
        </SubmitButton>
      </div>

      {serverMessage ? (
        <p role="alert" className="text-xs text-red-700">
          {serverMessage}
        </p>
      ) : null}
    </form>
  );
}
