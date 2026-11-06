"use client";

import { useActionState } from "react";

import { Select, Textarea } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FormState, addContact } from "@/lib/learning/actions";
import { PUBLISHABILITY } from "@/lib/learning/types";

export function ContactForm({ funders }: { funders: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addContact, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input id="contact-name" name="name" required maxLength={300} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-role">Role</Label>
          <Input id="contact-role" name="role" maxLength={200} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-funder">Funder</Label>
          <Select id="contact-funder" name="funderId" defaultValue="">
            <option value="">Not tied to a funder</option>
            {funders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email (private)</Label>
          <Input id="contact-email" name="email" type="email" maxLength={254} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Phone (private)</Label>
          <Input id="contact-phone" name="phone" maxLength={50} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-publishability">Publishability</Label>
          <Select id="contact-publishability" name="publishability" defaultValue="private">
            {PUBLISHABILITY.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-notes">Notes</Label>
        <Textarea id="contact-notes" name="notes" className="min-h-16" maxLength={4000} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save contact"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
