import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { getTranslations } from "@/i18n";

interface Props {
  serverError?: string | null;
  next?: string | null;
}

export default function MagicLinkForm({ serverError, next }: Props) {
  const t = getTranslations();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);

  function validate() {
    if (!email.trim()) {
      setEmailError(t("auth.signin.email_required"));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t("auth.signin.email_invalid"));
      return false;
    }
    setEmailError(undefined);
    return true;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/auth/magic-link" className="space-y-4" onSubmit={handleSubmit} noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormField
        id="email"
        type="email"
        label={t("auth.signin.email_label")}
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (emailError) setEmailError(undefined);
        }}
        placeholder="you@example.com"
        error={emailError}
        icon={<Mail className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={t("auth.signin.submit_pending")} icon={<Send className="size-4" />}>
        {t("auth.signin.submit")}
      </SubmitButton>
    </form>
  );
}
