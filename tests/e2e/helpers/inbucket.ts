import { APP_BASE_URL, INBUCKET_BASE_URL } from "../constants";

const DEFAULT_TIMEOUT_MS = 30_000;
const INITIAL_POLL_MS = 500;
const MAX_POLL_MS = 2_000;

const PREREQUISITE_HINT =
  "Ensure local Supabase is running (`npx supabase start`) and populate `.env` / `.dev.vars` from `npx supabase status`.";

/** Mailpit search result row (subset of GET /api/v1/search). */
interface MailpitSearchMessage {
  ID: string;
  Created: string;
}

interface MailpitSearchResponse {
  messages?: MailpitSearchMessage[];
}

interface MailpitMessageDetail {
  HTML?: string;
  Text?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isMailpitUnreachable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = error.cause;
  const causeCode =
    cause !== null && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : undefined;

  return (
    error.name === "TypeError" ||
    causeCode === "ECONNREFUSED" ||
    causeCode === "ENOTFOUND" ||
    causeCode === "EHOSTUNREACH"
  );
}

function extractMagicLinkConfirmUrl(body: string): string | null {
  const hrefPattern = /href="([^"]+)"/gi;
  const confirmPath = `${APP_BASE_URL}/auth/confirm`;

  for (const match of body.matchAll(hrefPattern)) {
    const href = match[1];
    if (!href.startsWith(confirmPath)) {
      continue;
    }

    try {
      const url = new URL(href);
      if (url.searchParams.has("token_hash") && url.searchParams.get("type") === "magiclink") {
        return href;
      }
    } catch {
      // Skip malformed href values.
    }
  }

  return null;
}

async function fetchLatestMagicLink(email: string): Promise<string | null> {
  const searchUrl = `${INBUCKET_BASE_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=10`;

  let searchResponse: Response;
  try {
    searchResponse = await fetch(searchUrl);
  } catch (error) {
    if (isMailpitUnreachable(error)) {
      throw new Error(`Local email capture is unreachable at ${INBUCKET_BASE_URL}. ${PREREQUISITE_HINT}`, {
        cause: error,
      });
    }
    throw error;
  }

  if (!searchResponse.ok) {
    throw new Error(
      `Mailpit search failed (${String(searchResponse.status)} ${searchResponse.statusText}). ${PREREQUISITE_HINT}`,
    );
  }

  const searchPayload = (await searchResponse.json()) as MailpitSearchResponse;
  const messages = searchPayload.messages ?? [];

  if (messages.length === 0) {
    return null;
  }

  const sorted = [...messages].sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());

  for (const message of sorted) {
    const detailResponse = await fetch(`${INBUCKET_BASE_URL}/api/v1/message/${message.ID}`);
    if (!detailResponse.ok) {
      continue;
    }

    const detail = (await detailResponse.json()) as MailpitMessageDetail;
    const body = detail.HTML ?? detail.Text ?? "";
    const confirmUrl = extractMagicLinkConfirmUrl(body);

    if (confirmUrl) {
      return confirmUrl;
    }
  }

  return null;
}

/**
 * Poll local Mailpit (Supabase CLI email capture on port 54324) for the latest
 * magic-link confirm URL sent to `email`.
 */
export async function waitForMagicLink(email: string, options?: { timeoutMs?: number }): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  let pollMs = INITIAL_POLL_MS;

  while (Date.now() < deadline) {
    const confirmUrl = await fetchLatestMagicLink(email);
    if (confirmUrl) {
      return confirmUrl;
    }

    await sleep(pollMs);
    pollMs = Math.min(pollMs * 2, MAX_POLL_MS);
  }

  throw new Error(
    `Timed out after ${String(timeoutMs)}ms waiting for a magic-link email to ${email}. ${PREREQUISITE_HINT}`,
  );
}

/** Remove prior messages for the mailbox so polling returns only fresh links. */
export async function clearMailbox(email: string): Promise<void> {
  const deleteUrl = `${INBUCKET_BASE_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`;

  try {
    await fetch(deleteUrl, { method: "DELETE" });
  } catch (error) {
    if (isMailpitUnreachable(error)) {
      throw new Error(`Local email capture is unreachable at ${INBUCKET_BASE_URL}. ${PREREQUISITE_HINT}`, {
        cause: error,
      });
    }
    throw error;
  }
}
