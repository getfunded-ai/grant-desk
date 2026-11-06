import type { Evidence, ProducedBy } from "@/lib/learning/types";

/** The label every AI-produced item carries: model, date, and the evidence it cites (honesty rule 2). */
export function AiLabel({ by, evidence }: { by: ProducedBy; evidence: Evidence[] }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>
        AI, {by.model}, {by.date}
        {by.tool && by.tool !== "Not stated" ? ` · ${by.tool}` : ""}
      </p>
      {evidence.length === 0 ? (
        <p>Evidence: not given.</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4">
          {evidence.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{e.source_ref}</span>
              {e.quote ? <> : &ldquo;{e.quote}&rdquo;</> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Empty views never read "none" or "0". */
export function NotAvailable({ children }: { children?: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children ?? "Not available"}</p>;
}
