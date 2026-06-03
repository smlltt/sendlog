import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  pending?: boolean;
  /**
   * Optional class overrides merged with `cn()` (tailwind-merge wins on
   * conflict). The auth flow leaves this undefined and gets the default
   * full-width purple pill; inline contexts (e.g. the climb-log row
   * action) override `w-full` to keep the button at content width.
   */
  className?: string;
}

export function SubmitButton({ pendingText, icon, children, pending: pendingOverride, className }: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingOverride ?? formPending;

  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn(
        "w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500",
        className,
      )}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
