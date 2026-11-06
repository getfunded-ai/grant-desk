"use client";

import { useActionState, useState, useTransition } from "react";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/actions";
import {
  createContact,
  createDeadline,
  createNote,
  createTask,
  decideProposal,
  moveGrantStage,
  toggleTask,
} from "@/lib/pipeline/actions";
import { GRANT_STAGES, STAGE_LABELS, type GrantStage, type Preset } from "@/lib/pipeline/stages";
import { COMMON_ZONES } from "./grant-form";

const select = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function StageMenu({
  grantId,
  stage,
  preset,
}: {
  grantId: string;
  stage: GrantStage;
  preset: Preset;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ status: "idle" });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="stage" className="text-sm text-muted-foreground">
        Stage
      </label>
      <select
        id="stage"
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={stage}
        disabled={pending}
        onChange={(event) =>
          startTransition(async () => setState(await moveGrantStage(grantId, event.target.value)))
        }
      >
        {GRANT_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[preset][s]}
          </option>
        ))}
      </select>
      <FormMessage state={state} />
    </div>
  );
}

export function NoteForm({ grantId }: { grantId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createNote, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="grantId" value={grantId} />
      <Label htmlFor="note-body" className="sr-only">
        Note
      </Label>
      <textarea
        id="note-body"
        name="body"
        required
        rows={3}
        maxLength={20000}
        placeholder="What happened, what was said, what to remember."
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add note"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function TaskForm({ grantId }: { grantId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTask, {
    status: "idle",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="grantId" value={grantId} />
      <div className="min-w-48 flex-1 space-y-1">
        <Label htmlFor="task-title">New task</Label>
        <Input id="task-title" name="title" required maxLength={500} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="task-due">Due</Label>
        <Input id="task-due" name="dueDate" type="date" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function TaskCheckbox({
  taskId,
  grantId,
  done,
  title,
}: {
  taskId: string;
  grantId: string;
  done: boolean;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={`Mark "${title}" ${done ? "open" : "done"}`}
      checked={done}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.checked;
        startTransition(() => void toggleTask(taskId, grantId, next));
      }}
    />
  );
}

export function ContactForm({ grantId }: { grantId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createContact, {
    status: "idle",
  });
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="grantId" value={grantId} />
      <div className="space-y-1">
        <Label htmlFor="contact-name">Name</Label>
        <Input id="contact-name" name="name" required maxLength={300} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contact-role">Role</Label>
        <Input id="contact-role" name="role" maxLength={200} placeholder="Program officer" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" name="email" type="email" maxLength={254} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contact-phone">Phone</Label>
        <Input id="contact-phone" name="phone" maxLength={50} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add contact"}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DeadlineForm({ grantId, defaultZone }: { grantId: string; defaultZone: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createDeadline, {
    status: "idle",
  });
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="grantId" value={grantId} />
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="deadline-title">Key date</Label>
        <Input
          id="deadline-title"
          name="title"
          required
          maxLength={500}
          placeholder="Letter of intent due"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="deadline-kind">Kind</Label>
        <select id="deadline-kind" name="kind" className={select} defaultValue="application">
          <option value="loi">Letter of intent</option>
          <option value="application">Application</option>
          <option value="report">Report</option>
          <option value="internal">Internal</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="deadline-date">Date</Label>
        <Input id="deadline-date" name="dueDate" type="date" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="deadline-time">Time (optional)</Label>
        <Input id="deadline-time" name="dueTime" type="time" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="deadline-zone">Time zone</Label>
        <Input id="deadline-zone" name="dueZone" placeholder={defaultZone} list="deadline-zones" />
        <datalist id="deadline-zones">
          {COMMON_ZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add key date"}
        </Button>
      </div>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ProposalButtons({ proposalId }: { proposalId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ status: "idle" });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => setState(await decideProposal(proposalId, "accepted")))
        }
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => setState(await decideProposal(proposalId, "rejected")))
        }
      >
        Reject
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
