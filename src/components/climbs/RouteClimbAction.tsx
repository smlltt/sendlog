/**
 * <RouteClimbAction> — encapsulates the signed-in per-route UI inside the
 * crag route table.
 *
 * Three visual states feed into one island so the route row stays
 * collapsed by default and never navigates away on save:
 *
 * - Collapsed (default): a Polish indicator showing "N przejść,
 *   ostatnie YYYY-MM-DD" (or "Brak zapisanych przejść" when N=0) plus
 *   a button to open the inline form.
 * - Expanded: <ClimbLogForm> rendered inline, with the form's
 *   SubmitButton driving the >2 s save progress feedback.
 * - Success: a brief inline "Zapisano" indicator immediately after the
 *   201 lands, then collapses back. The summary's `count` increments
 *   and `latestClimbedOn` updates without a re-fetch.
 *
 * The component receives `initialSummary` from the server-side group-by
 * done in `src/pages/regiony/[region]/[crag].astro` (`listClimbs(client)`
 * → group by `routeId`), keeps its own copy in state, and updates that
 * copy on save. The Astro page never re-renders during the user's
 * session, so the React-side summary is the source of truth after the
 * first save.
 */

import { useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { getTranslations, format as formatTpl } from "@/i18n";
import ClimbLogForm from "@/components/climbs/ClimbLogForm";
import type { ClimbResponse, RouteClimbSummary } from "@/components/climbs/types";

interface RouteClimbActionProps {
  routeId: string;
  initialSummary: RouteClimbSummary;
  defaultClimbedOn: string;
}

/**
 * Polish plural rule for the climb-count indicator. v1 carries one
 * locale so the rule lives here; when a second locale lands, the three
 * keys move into a per-locale helper alongside `pluralizeCrags`.
 *
 * - 1 → "1 przejście" (one)
 * - 2-4, except 12-14 → "{count} przejścia" (few)
 * - everything else → "{count} przejść" (many)
 */
function pluralizeClimbCount(count: number): string {
  const t = getTranslations();
  if (count === 1) return t("climbs.action.indicator_count_one");
  const lastTwo = count % 100;
  const last = count % 10;
  const isFew = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14);
  const template = isFew ? t("climbs.action.indicator_count_few") : t("climbs.action.indicator_count_many");
  return formatTpl(template, { count });
}

function indicatorText(summary: RouteClimbSummary): string {
  const t = getTranslations();
  if (summary.count === 0) return t("climbs.action.none_logged");
  const head = pluralizeClimbCount(summary.count);
  if (!summary.latestClimbedOn) return head;
  const tail = formatTpl(t("climbs.action.indicator_latest"), { date: summary.latestClimbedOn });
  return `${head} · ${tail}`;
}

export default function RouteClimbAction({ routeId, initialSummary, defaultClimbedOn }: RouteClimbActionProps) {
  const t = getTranslations();
  const [summary, setSummary] = useState<RouteClimbSummary>(initialSummary);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);

  function handleSaved(climb: ClimbResponse) {
    setSummary((prev) => {
      const nextCount = prev.count + 1;
      // `climbedOn` is a `YYYY-MM-DD` UTC date string — lexicographic
      // comparison matches chronological order, no Date parsing needed.
      const nextLatest =
        prev.latestClimbedOn === null || climb.climbedOn > prev.latestClimbedOn
          ? climb.climbedOn
          : prev.latestClimbedOn;
      return { count: nextCount, latestClimbedOn: nextLatest };
    });
    setIsExpanded(false);
    setRecentlySaved(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-700" aria-live="polite">
          {indicatorText(summary)}
        </span>
        {recentlySaved && !isExpanded ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {t("climbs.form.success")}
          </span>
        ) : null}
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => {
              setIsExpanded(true);
              setRecentlySaved(false);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
          >
            <Plus className="size-3" aria-hidden="true" />
            {summary.count === 0 ? t("climbs.action.log_button") : t("climbs.action.add_another")}
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <ClimbLogForm
          routeId={routeId}
          defaultClimbedOn={defaultClimbedOn}
          onSaved={handleSaved}
          onCancel={() => {
            setIsExpanded(false);
          }}
        />
      ) : null}
    </div>
  );
}
