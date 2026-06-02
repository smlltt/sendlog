#!/usr/bin/env node
/**
 * check-i18n.mjs — static i18n coverage guard for the F-03 verification harness.
 *
 * Scope: current non-smoke product shell plus forward-compatible climb-log
 * paths. The scoped globs are the canonical inputs to the
 * `npm run guardrails:i18n` check; widening scope later is a one-line edit to
 * `IN_SCOPE_GLOBS` below.
 *
 * What it catches
 * - Curated English words that show up unwrapped in JSX/Astro text positions
 *   (e.g. `<h1>Sign in</h1>`) or in `placeholder=`, `aria-label=`, `title=`,
 *   `alt=`, and `pendingText=` attribute values.
 *
 * What it intentionally misses
 * - Novel English phrasings not in `KNOWN_ENGLISH_WORDS`. That gap is closed
 *   by the manual Polish walkthrough in `docs/verification/beta-flow-checklist.md`.
 * - Server code lines that route through `t("…")` from `src/i18n` (skipped).
 * - Comment lines (`//`, `/*`, `*`, `<!--`) — never rendered to users.
 * - Lines explicitly marked `// i18n-allow` (JS / TS comment) or
 *   `<!-- i18n-allow -->` (HTML) or the JSX-block-comment variant.
 *
 * Implemented in pure Node (no ripgrep subprocess) so CI runners without `rg`
 * still pass; the patterns themselves are the kind a ripgrep one-liner would
 * use.
 *
 * Exit code: 0 = clean, 1 = at least one violation. Violations are printed
 * one-per-line as `<file>:<line>: <matched literal>`.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
import { glob } from "node:fs/promises";

// Node 22's `fs.glob` is marked experimental and prints a warning on import.
// The API is stable enough for our purposes (one well-known consumer in CI)
// and dropping the warning keeps CI logs readable. If `fs.glob` is promoted
// or removed in a later Node version, this filter becomes a no-op or the
// import itself fails — either signals a needed rewrite, both loud enough.
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (typeof warning === "string" && warning.includes("glob is an experimental feature")) return;
  return originalEmitWarning.call(process, warning, ...rest);
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Globs scoped to the current non-smoke product shell. Add a glob here to
 * widen the audit; remove one (carefully) to narrow it. Patterns relative to
 * the repo root.
 */
const IN_SCOPE_GLOBS = [
  "src/components/auth/**/*.{astro,tsx,ts}",
  "src/pages/auth/**/*.astro",
  "src/pages/index.astro",
  "src/pages/404.astro",
  "src/pages/dashboard.astro",
  "src/pages/regiony/[region]/index.astro",
  "src/pages/regiony/[region]/[crag].astro",
  "src/components/catalog/**/*.{astro,tsx,ts}",
  "src/layouts/**/*.astro",
  "src/lib/auth/**/*.ts",
  "src/lib/config-status.ts",
  // Forward-compat for S-04 / S-06. The glob walker tolerates non-existent
  // paths — these silently match nothing today and start checking the day
  // the climb-log scaffolding lands.
  "src/components/climbs/**/*.{astro,tsx,ts}",
  "src/pages/climbs/**/*.astro",
  "src/pages/historia.astro",
  "src/pages/projekty.astro",
];

/**
 * Files inside in-scope globs that the guard should skip entirely. Includes
 * documentation directories and dictionary files that legitimately contain
 * the English keywords as TypeScript identifiers, not as user-facing strings.
 */
const SKIP_FILES = new Set([
  "src/components/auth/__tests__/README.md",
  "src/components/catalog/__tests__/README.md",
  "src/lib/auth/__tests__/README.md",
]);

/**
 * Curated English words that, when seen in a user-facing line, indicate a
 * missing translation. Case-sensitive on purpose: capitalized JSX labels and
 * sentence-leading words match while lowercase code identifiers (variable
 * names, CSS classes, import paths) don't.
 *
 * Multi-word entries match as substrings; single words use word boundaries.
 *
 * Note: the plan's initial list also included `Error`, but that word collides
 * with the JavaScript built-in `Error` class and the `instanceof Error`
 * idiom — it generates noisy false positives across every error-handling
 * code path. Dropped here; the manual Polish walkthrough in
 * `docs/verification/beta-flow-checklist.md` is the safety net for the
 * "Error" phrasing.
 */
const KNOWN_ENGLISH_WORDS = [
  "Email",
  "Password",
  "Sign in",
  "Sign up",
  "Sign out",
  "Save",
  "Cancel",
  "Continue",
  "Submit",
  "Search",
  "Filter",
  "Settings",
  "Profile",
  "Welcome",
  "Required",
  "Optional",
  "Loading",
  "Sending",
  "Check your email",
];

/**
 * Allow-listed literal substrings. These are removed from each line before
 * the English-word check so a line like `placeholder="you@example.com"` does
 * not trip on incidental matches.
 *
 * Add brand names, locale-neutral examples, and third-party legally-required
 * strings here.
 */
const ALLOWED_LITERALS = [
  "you@example.com",
  "SendLog",
  "Supabase",
  "Astro",
  "Cloudflare",
  "OpenStreetMap",
];

const TRANSLATED_LINE_MARKERS = ["t(\"", "t('", "i18n-allow", "getTranslations", "AUTH_ERROR_KEYS"];

const COMMENT_LINE_PREFIXES = ["//", "/*", "*", "<!--", "#"];

function isCommentOnly(trimmed) {
  if (trimmed.length === 0) return true;
  return COMMENT_LINE_PREFIXES.some((p) => trimmed.startsWith(p));
}

function stripAllowed(line) {
  let out = line;
  for (const literal of ALLOWED_LITERALS) {
    out = out.split(literal).join("");
  }
  return out;
}

function findMatch(line) {
  for (const word of KNOWN_ENGLISH_WORDS) {
    // Single-token words: enforce word boundaries so e.g. "Email" doesn't
    // match "emailRedirectTo". Multi-word phrases match literally.
    const re = /\s/.test(word)
      ? new RegExp(word.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      : new RegExp(`\\b${word}\\b`);
    if (re.test(line)) return word;
  }
  return null;
}

async function* expandGlobs(patterns) {
  const seen = new Set();
  for (const pattern of patterns) {
    for await (const entry of glob(pattern, { cwd: REPO_ROOT })) {
      const rel = entry.replaceAll("\\", "/");
      if (seen.has(rel)) continue;
      seen.add(rel);
      yield rel;
    }
  }
}

async function scanFile(relPath) {
  const violations = [];
  const absPath = resolve(REPO_ROOT, relPath);
  let contents;
  try {
    contents = await readFile(absPath, "utf8");
  } catch {
    return violations; // Glob may yield path that disappeared mid-run; tolerate.
  }
  const lines = contents.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (isCommentOnly(trimmed)) continue;
    if (TRANSLATED_LINE_MARKERS.some((m) => raw.includes(m))) continue;
    const stripped = stripAllowed(raw);
    const hit = findMatch(stripped);
    if (hit !== null) {
      violations.push({ file: relPath, line: i + 1, literal: hit, raw: trimmed });
    }
  }
  return violations;
}

async function main() {
  const violations = [];
  for await (const file of expandGlobs(IN_SCOPE_GLOBS)) {
    if (SKIP_FILES.has(file)) continue;
    const fileViolations = await scanFile(file);
    violations.push(...fileViolations);
  }

  if (violations.length === 0) {
    console.log("guardrails:i18n — OK (no inline English literals in audited scope)");
    process.exit(0);
  }

  for (const v of violations) {
    const repoRel = relative(REPO_ROOT, resolve(REPO_ROOT, v.file));
    console.error(`${repoRel}:${v.line}: ${v.literal} — ${v.raw}`);
  }
  console.error("");
  console.error(`guardrails:i18n — ${violations.length} violation(s) found`);
  console.error("Wrap the strings in t('…') (see src/i18n/ui.ts) or mark intentional");
  console.error("exceptions with `// i18n-allow`, `{/* i18n-allow */}`, or `<!-- i18n-allow -->`.");
  process.exit(1);
}

main().catch((err) => {
  console.error("guardrails:i18n — script crashed");
  console.error(err);
  process.exit(2);
});
