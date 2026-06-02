/**
 * <Pending> — reusable inline spinner for non-form pending states.
 *
 * Companion to `<SubmitButton>` (which keeps its own inlined spinner for the
 * form-submit lifecycle via `useFormStatus`). This primitive covers the
 * other >2-second cases the climb-log + history flows will hit: deferred
 * fetches, route loading states, optimistic updates in flight.
 *
 * Visual language is intentionally aligned with `SubmitButton`'s spinner
 * (border-based + `animate-spin`) so the form-submit and non-form contexts
 * feel like one app. Colors use `currentColor` so the spinner inherits the
 * surrounding text color and works on light catalog/auth surfaces as well as
 * dark contexts; callers can override via `className`.
 *
 * Accessibility: the wrapper always carries `role="status"` and
 * `aria-live="polite"` so screen readers announce the loading state. When
 * `label` is provided it renders as visible text and supplies the wrapper's
 * accessible name. When `label` is omitted, no visible text is rendered and
 * a default `aria-label` ("Ładowanie") is resolved via `getTranslations` so
 * the announcement still happens without forcing every caller to pass a
 * label.
 */

import { cn } from "@/lib/utils";
import { getTranslations } from "@/i18n";

interface PendingProps {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "size-3 border",
  md: "size-4 border-2",
} as const;

export default function Pending({ label, size = "md", className }: PendingProps) {
  const t = getTranslations();
  const fallbackLabel = t("common.loading");

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ? label : fallbackLabel}
      className={cn("inline-flex items-center gap-2 text-current", className)}
    >
      <span
        aria-hidden="true"
        className={cn("inline-block animate-spin rounded-full border-current/30 border-t-current", SIZE_CLASSES[size])}
      />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
