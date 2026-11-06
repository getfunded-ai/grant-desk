import { NotAvailable } from "@/components/learning/ai-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { getDb } from "@/lib/learning/db";
import { listContacts, listFunders, listGrants, listTouches } from "@/lib/learning/queries";

import { ContactForm } from "./contact-form";
import { TouchForm } from "./touch-form";

export const metadata = { title: "Contacts · Grant Desk" };

const CAN_EDIT = ["owner", "admin", "editor"];

function when(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "Not available";
}

export default async function ContactsPage() {
  const { active } = await requireActiveOrganization();
  const db = await getDb();
  if (!db)
    return <NotAvailable>The database is not set up on this copy of Grant Desk yet.</NotAvailable>;
  const [contacts, funders, grants, touches] = await Promise.all([
    listContacts(db, active.id),
    listFunders(db, active.id),
    listGrants(db, active.id),
    listTouches(db, active.id, 50),
  ]);
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const canEdit = CAN_EDIT.includes(active.role);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts and touches</h1>
        <p className="text-sm text-muted-foreground">
          The people {active.name} talks to, and each email, call, meeting, letter or note, logged
          by hand. The app never sends a message; people do.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
          <CardDescription>
            Email and phone stay private and are never put in a packet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <NotAvailable>No contacts recorded yet.</NotAvailable>
          ) : (
            <ul className="divide-y">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {[c.role, c.funder_name].filter(Boolean).join(" · ") ||
                      "Role and funder not stated"}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.publishability}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    last touch:{" "}
                    {c.last_touch_at
                      ? `${when(c.last_touch_at)} (${c.last_touch_kind})`
                      : "Not available"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Log a touch</CardTitle>
              <CardDescription>What happened, when, with whom. Nothing is sent.</CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <NotAvailable>Add a contact first.</NotAvailable>
              ) : (
                <TouchForm
                  contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
                  grants={grants.map((g) => ({ id: g.id, title: g.title }))}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Add a contact</CardTitle>
              <CardDescription>
                Mark it public only if the details come from a public source.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactForm funders={funders} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent touches</CardTitle>
          <CardDescription>Newest first, up to fifty.</CardDescription>
        </CardHeader>
        <CardContent>
          {touches.length === 0 ? (
            <NotAvailable>No touches logged yet.</NotAvailable>
          ) : (
            <ul className="divide-y">
              {touches.map((t) => (
                <li key={t.id} className="space-y-1 py-3 text-sm">
                  <p>
                    <span className="font-medium">
                      {contactName.get(t.contact_id) ?? "Not available"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {t.kind} {t.direction === "out" ? "out" : "in"} · {when(t.happened_at)}
                    </span>
                  </p>
                  <p>{t.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
