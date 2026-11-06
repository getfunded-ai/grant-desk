import { toggleChecklistItem } from "@/lib/compliance/actions";
import { formatDate, isoDateOf } from "@/lib/compliance/dates";
import { ECFR_PART_200_URL } from "@/lib/compliance/rules";
import type { ComplianceItemRow } from "@/lib/compliance/store";
import { ActionForm } from "./action-form";
import { AddChecklistItemForm } from "./small-forms";

export function Checklist({
  grantId,
  awardId,
  isFederal,
  items,
  canEdit,
}: {
  grantId: string;
  awardId: string;
  isFederal: boolean;
  items: ComplianceItemRow[];
  canEdit: boolean;
}) {
  const done = items.filter((i) => i.completed_at).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {done} of {items.length} done.{" "}
        {isFederal ? (
          <>
            Items name their section of{" "}
            <a
              className="underline underline-offset-4"
              href={ECFR_PART_200_URL}
              target="_blank"
              rel="noreferrer"
            >
              2 CFR 200
            </a>
            . The agency’s own terms may add more.
          </>
        ) : (
          "Plain good practice for a foundation or corporate grant; the agreement may ask for more."
        )}{" "}
        This list is a reminder, not legal advice.
      </p>
      <ul className="divide-y">
        {items.map((item) => {
          const isDone = Boolean(item.completed_at);
          return (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className={isDone ? "text-muted-foreground line-through" : ""}>
                  {item.title}
                </div>
                {item.detail ? (
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                ) : null}
                {isDone ? (
                  <div className="text-xs text-muted-foreground">
                    Done {formatDate(isoDateOf(item.completed_at))}
                  </div>
                ) : null}
              </div>
              {canEdit ? (
                <ActionForm
                  action={toggleChecklistItem}
                  fields={{ grantId, itemId: item.id, done: isDone ? "0" : "1" }}
                  label={isDone ? "Undo" : "Mark done"}
                  size="xs"
                  variant={isDone ? "ghost" : "outline"}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <div className="border-t pt-4">
          <AddChecklistItemForm grantId={grantId} awardId={awardId} />
        </div>
      ) : null}
    </div>
  );
}
