#!/usr/bin/env node
/**
 * check-progress.mjs — static progress-feedback guard for the F-03
 * verification harness.
 *
 * Reads `docs/verification/progress-feedback-actions.md`, finds the actions
 * table, and for each row whose Status is `shipped` and whose file exists,
 * asserts that the file imports the named primitive.
 *
 * The intent is narrow: catch the case where a new action file in scope
 * ships without using one of the three agreed primitives (`SubmitButton`,
 * `Pending`, `Skeleton`). The behavioral check (the spinner actually shows
 * within ~300 ms on Slow 4G) lives in the manual checklist; this script is
 * just the structural floor.
 *
 * Rows with `Status: planned: …` are skipped silently — the file does not
 * exist yet and listing it is a forward-compatibility signal, not a
 * regression. The moment the file appears and the Status flips to `shipped`,
 * this guard switches on for that row.
 *
 * Implemented in pure Node (no ripgrep subprocess) so CI runners without
 * `rg` still pass.
 *
 * Exit codes: 0 = clean, 1 = at least one shipped row failed the import
 * check, 2 = the table itself could not be parsed.
 */

import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ACTIONS_DOC = "docs/verification/progress-feedback-actions.md";

/**
 * Known primitives and the import-path substrings the guard will accept as
 * evidence the file uses each one. Multiple acceptable substrings allow the
 * guard to tolerate `import X from "@/components/ui/Pending"` and
 * `import { X } from "@/components/auth/SubmitButton"` alike.
 */
const PRIMITIVE_IMPORT_HINTS = {
  SubmitButton: ["@/components/auth/SubmitButton"],
  Pending: ["@/components/ui/Pending"],
  Skeleton: ["@/components/ui/Skeleton"],
};

/**
 * Parse the second markdown pipe-table in the actions doc (the first one is
 * the legend for the three primitives). Returns an array of
 * `{ action, file, primitive, status }`. Throws on unrecognized structure
 * so the script exits 2 rather than silently passing.
 */
function parseActionsTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const actionsHeading = lines.findIndex((l) => l.trim() === "## Actions");
  if (actionsHeading === -1) {
    throw new Error("missing '## Actions' heading");
  }

  // Find the first table header row after the heading.
  let headerIdx = -1;
  for (let i = actionsHeading + 1; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (t.startsWith("| Action") || t.startsWith("|Action")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error("no action table found under '## Actions'");
  }

  // Data rows start two lines below the header (skip the separator row).
  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim().startsWith("|")) break;
    const cells = raw
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 5) {
      throw new Error(`row ${i + 1}: expected 5 cells, got ${cells.length}`);
    }
    const [action, fileCell, primitiveCell, , statusCell] = cells;
    rows.push({
      action: stripCodeFences(action),
      file: stripCodeFences(fileCell),
      primitive: stripCodeFences(primitiveCell),
      status: stripCodeFences(statusCell),
    });
  }
  return rows;
}

function stripCodeFences(s) {
  return s.replace(/^`/, "").replace(/`$/, "").trim();
}

async function fileExists(relPath) {
  try {
    await access(resolve(REPO_ROOT, relPath), fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileImportsPrimitive(relPath, primitive) {
  const hints = PRIMITIVE_IMPORT_HINTS[primitive];
  if (!hints) {
    return { ok: false, reason: `unknown primitive "${primitive}"` };
  }
  let contents;
  try {
    contents = await readFile(resolve(REPO_ROOT, relPath), "utf8");
  } catch (err) {
    return { ok: false, reason: `unreadable: ${err.message}` };
  }
  const hit = hints.some((h) => contents.includes(h));
  return hit
    ? { ok: true }
    : { ok: false, reason: `missing import of ${primitive} (looked for: ${hints.join(", ")})` };
}

async function main() {
  let markdown;
  try {
    markdown = await readFile(resolve(REPO_ROOT, ACTIONS_DOC), "utf8");
  } catch (err) {
    console.error(`guardrails:progress — cannot read ${ACTIONS_DOC}`);
    console.error(err.message);
    process.exit(2);
  }

  let rows;
  try {
    rows = parseActionsTable(markdown);
  } catch (err) {
    console.error(`guardrails:progress — failed to parse actions table in ${ACTIONS_DOC}`);
    console.error(err.message);
    process.exit(2);
  }

  if (rows.length === 0) {
    console.error(`guardrails:progress — actions table is empty (${ACTIONS_DOC})`);
    process.exit(2);
  }

  const violations = [];
  let shippedChecked = 0;
  let plannedSkipped = 0;

  for (const row of rows) {
    if (row.status !== "shipped") {
      plannedSkipped += 1;
      continue;
    }
    const exists = await fileExists(row.file);
    if (!exists) {
      violations.push({
        row,
        reason: `Status is "shipped" but file does not exist: ${row.file}`,
      });
      continue;
    }
    const check = await fileImportsPrimitive(row.file, row.primitive);
    if (!check.ok) {
      violations.push({ row, reason: check.reason });
      continue;
    }
    shippedChecked += 1;
  }

  if (violations.length === 0) {
    console.log(
      `guardrails:progress — OK (${shippedChecked} shipped row(s) checked, ${plannedSkipped} planned row(s) skipped)`,
    );
    process.exit(0);
  }

  for (const v of violations) {
    console.error(`${v.row.file}: ${v.reason} [action: ${v.row.action}]`);
  }
  console.error("");
  console.error(`guardrails:progress — ${violations.length} violation(s) found`);
  console.error(
    `See ${ACTIONS_DOC} for the agreed primitives and how to add a new action.`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("guardrails:progress — script crashed");
  console.error(err);
  process.exit(2);
});
