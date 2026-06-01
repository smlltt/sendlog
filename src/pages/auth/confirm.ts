import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { buildSignInRedirect, MAGIC_LINK_OTP_TYPE, sanitizeNextPath } from "@/lib/auth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = sanitizeNextPath(url.searchParams.get("next"));

  // The Supabase email template appends `&type=<verified EmailOtpType>` —
  // any other value (including the various non-passwordless OTP types) is
  // refused here so this route only completes the passwordless flow.
  if (!tokenHash || type !== MAGIC_LINK_OTP_TYPE) {
    return context.redirect(buildSignInRedirect({ next, error: "invalid_or_expired_link" }));
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(buildSignInRedirect({ next, error: "missing_config" }));
  }

  const { error } = await supabase.auth.verifyOtp({ type: MAGIC_LINK_OTP_TYPE, token_hash: tokenHash });
  if (error) {
    return context.redirect(buildSignInRedirect({ next, error: "invalid_or_expired_link" }));
  }

  return context.redirect(next);
};
