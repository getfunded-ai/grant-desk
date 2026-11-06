import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FUNDING_CATEGORY_LABELS } from "@/lib/grants-gov/codes";
import type { Agency } from "@/lib/grants-gov/map";
import type { OpportunityFilters } from "@/lib/grants-gov/store";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * The filter form. A plain GET form: the page reads the query string, so every result list has
 * a shareable address and the form works without JavaScript.
 */
export function OpportunityFilters({
  filters,
  agencies,
}: {
  filters: OpportunityFilters;
  agencies: Agency[];
}) {
  const departments = agencies.filter((a) => a.code === a.top_agency_code);
  const subAgencies = (top: string) =>
    agencies.filter((a) => a.top_agency_code === top && a.code !== top);
  const categoryOptions = Object.entries(FUNDING_CATEGORY_LABELS).sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

  return (
    <form method="get" action="/opportunities" className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="q">Keyword</Label>
          <Input
            id="q"
            name="q"
            defaultValue={filters.keyword}
            placeholder="Title, agency, number or words in the notice"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="elig">Who may apply</Label>
          <select id="elig" name="elig" defaultValue={filters.eligibility} className={selectClass}>
            <option value="nonprofit">Nonprofits (501(c)(3) or not)</option>
            <option value="12">501(c)(3) nonprofits only</option>
            <option value="13">Nonprofits without 501(c)(3) only</option>
            <option value="any">Any applicant type</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="close">Closes within</Label>
          <select
            id="close"
            name="close"
            defaultValue={filters.closeWindow}
            className={selectClass}
          >
            <option value="any">Any time</option>
            <option value="30">Next 30 days</option>
            <option value="60">Next 60 days</option>
            <option value="90">Next 90 days</option>
            <option value="180">Next 180 days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="agency">Agency</Label>
          <select id="agency" name="agency" defaultValue={filters.agency} className={selectClass}>
            <option value="">All agencies</option>
            {departments.map((department) => {
              const children = subAgencies(department.code);
              return children.length ? (
                <optgroup key={department.code} label={department.name}>
                  <option value={department.code}>{department.name} (all)</option>
                  {children.map((agency) => (
                    <option key={agency.code} value={agency.code}>
                      {agency.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <option key={department.code} value={department.code}>
                  {department.name}
                </option>
              );
            })}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            multiple
            defaultValue={filters.categories}
            size={4}
            className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {categoryOptions.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Hold Ctrl or Cmd to pick more than one.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ceiling">Award ceiling at least</Label>
          <Input
            id="ceiling"
            name="ceiling"
            type="number"
            min={1}
            step={1000}
            inputMode="numeric"
            defaultValue={filters.minCeiling ?? ""}
            placeholder="US$"
          />
          <p className="text-xs text-muted-foreground">
            Leaves out notices whose ceiling is not stated.
          </p>
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-4">
        <legend className="sr-only">Status</legend>
        {(
          [
            ["open", "Open"],
            ["forecasted", "Forecast"],
            ["closed", "Closed (last year)"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="status"
              value={value}
              defaultChecked={filters.statuses.includes(value)}
              className="size-4"
            />
            {label}
          </label>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/opportunities"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Reset
          </Link>
          <Button type="submit">Apply filters</Button>
        </div>
      </fieldset>
    </form>
  );
}
