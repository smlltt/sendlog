/**
 * <Skeleton> — block placeholder for initial-load states that match the
 * expected content shape (history list rows, projects list, route-table
 * fallback while data resolves).
 *
 * Pure CSS animation (`animate-pulse`) — no JavaScript on the main thread,
 * no layout thrash. Renderable as a React island via `client:load`, but the
 * markup is also valid SSR; Astro consumers can drop it into the page tree
 * statically without hydration if they only need the shape, not the
 * fade-in/out cycle.
 *
 * Accessibility: wrapper carries `role="status"` and an `aria-label`
 * resolved via `getTranslations` so assistive tech announces "Ładowanie"
 * while the placeholder is on screen. The pulsing rows themselves are
 * `aria-hidden` to avoid spamming the announcement.
 */

import { cn } from "@/lib/utils";
import { getTranslations } from "@/i18n";

interface SkeletonProps {
  rows?: number;
  rowClassName?: string;
  className?: string;
}

export default function Skeleton({ rows = 3, rowClassName, className }: SkeletonProps) {
  const t = getTranslations();

  return (
    <div role="status" aria-label={t("common.loading")} className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, idx) => (
        <span
          key={idx}
          aria-hidden="true"
          className={cn("block h-4 w-full animate-pulse rounded bg-slate-200", rowClassName)}
        />
      ))}
    </div>
  );
}
