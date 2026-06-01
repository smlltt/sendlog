import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { buildCheckEmailRedirect, buildSignInRedirect, sanitizeNextPath } from "@/lib/auth";

export const prerender = false;

const magicLinkSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const nextRaw = form.get("next");
  const next = sanitizeNextPath(typeof nextRaw === "string" ? nextRaw : null);

  const parsed = magicLinkSchema.safeParse({
    email: form.get("email"),
  });
  if (!parsed.success) {
    return context.redirect(buildSignInRedirect({ next, error: "invalid_email" }));
  }
  const { email } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(buildSignInRedirect({ next, error: "missing_config" }));
  }

  // Build an absolute, same-origin `/auth/confirm` URL with the sanitized
  // `next` carried in the query so the Supabase email template can append
  // `&token_hash={{ .TokenHash }}&type=<verified EmailOtpType>` to
  // `{{ .RedirectTo }}` and land users on this app's server route.
  const origin = new URL(context.request.url).origin;
  const emailRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  });
  if (error) {
    return context.redirect(buildSignInRedirect({ next, error: "magic_link_failed" }));
  }

  return context.redirect(buildCheckEmailRedirect(next), 303);
};
