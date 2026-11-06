"use client";

import { type ReactNode, useActionState } from "react";

import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/actions";

export type AwardAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * A one-button form for a row action (mark submitted, tick an item, remove). Hidden fields carry the
 * ids; `children` adds any input the action needs, such as a date. `confirm` asks before sending.
 */
export function ActionForm({
  action,
  fields,
  label,
  pendingLabel,
  variant = "outline",
  size = "sm",
  confirm,
  children,
  className,
}: {
  action: AwardAction;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "xs";
  confirm?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {
    status: "idle",
  });
  return (
    <form
      action={formAction}
      onSubmit={
        confirm
          ? (event) => {
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
      className={className ?? "flex flex-wrap items-center gap-2"}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? (pendingLabel ?? label) : label}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
