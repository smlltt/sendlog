import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

// Legacy password endpoint kept temporarily for rollback only. The visible
// auth surface is `/auth/signin` + `/api/auth/magic-link` (passwordless).
// No page in this app links to this endpoint after the passwordless flow
// lands — see `context/changes/passwordless-auth-flow/plan.md`.
export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/auth/confirm-email");
};
