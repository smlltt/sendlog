import { defineMiddleware } from "astro:middleware";
import { buildSignInRedirect } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/historia", "/private-state-smoke"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      // Preserve the original protected path (+ query) as a same-origin
      // `next` hint so passwordless confirm can return the user here.
      // `sanitizeNextPath` inside the helper drops anything unsafe.
      const intended = `${context.url.pathname}${context.url.search}`;
      return context.redirect(buildSignInRedirect({ next: intended }));
    }
  }

  return next();
});
