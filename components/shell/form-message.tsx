import type { FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** The one-line result under a form. Announced to screen readers. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        state.status === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {state.message}
    </p>
  );
}
