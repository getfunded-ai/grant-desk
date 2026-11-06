/**
 * CSV import of actuals: a file exported from the books, one spent line per row.
 *
 * Expected columns, found by header name in any order and any case: date, category, amount, and an
 * optional description (or memo, or notes). Dates are YYYY-MM-DD or M/D/YYYY. Amounts may carry a
 * currency sign, thousands separators, or parentheses for a credit. Rows that cannot be read are
 * reported with their line number and skipped; the good rows still import.
 *
 * Pure module: parses text, touches no database.
 */

import { type IsoDate, parseIsoDate } from "../compliance/dates";
import { parseAmount } from "../compliance/indirect";

export interface ActualRow {
  line: number;
  spentOn: IsoDate;
  category: string;
  amount: number;
  description: string | null;
}

export interface ParsedActuals {
  rows: ActualRow[];
  problems: string[];
  /** The header that was read, for the message on the page. */
  columns: string[];
}

export const MAX_IMPORT_ROWS = 5000;

/** RFC 4180-style split: quoted fields, doubled quotes, CRLF or LF line ends. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.startsWith("﻿") ? text.slice(1) : text;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const DATE_ALIASES = ["date", "spent on", "spent_on", "transaction date", "posted"];
const CATEGORY_ALIASES = ["category", "budget line", "budget_line", "line", "account"];
const AMOUNT_ALIASES = ["amount", "spent", "debit", "total"];
const DESCRIPTION_ALIASES = ["description", "memo", "notes", "note", "payee", "vendor"];

function findColumn(header: string[], aliases: string[]): number {
  const cleaned = header.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const index = cleaned.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

/** "3/14/2027" or "2027-03-14" → "2027-03-14"; anything else → null. */
export function parseFlexibleDate(text: string): IsoDate | null {
  const trimmed = text.trim();
  const iso = parseIsoDate(trimmed);
  if (iso) return iso;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (us) {
    const [, m, d, y] = us;
    return parseIsoDate(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  return null;
}

export function parseActualsCsv(text: string): ParsedActuals {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], problems: ["The file is empty."], columns: [] };
  const [header, ...body] = table;
  const dateCol = findColumn(header, DATE_ALIASES);
  const categoryCol = findColumn(header, CATEGORY_ALIASES);
  const amountCol = findColumn(header, AMOUNT_ALIASES);
  const descriptionCol = findColumn(header, DESCRIPTION_ALIASES);
  const missing = [
    dateCol < 0 ? "date" : null,
    categoryCol < 0 ? "category" : null,
    amountCol < 0 ? "amount" : null,
  ].filter((c): c is string => c !== null);
  if (missing.length > 0) {
    return {
      rows: [],
      problems: [
        `The first row must name these columns: ${missing.join(", ")}. Found: ${header.join(", ") || "nothing"}.`,
      ],
      columns: header,
    };
  }

  const rows: ActualRow[] = [];
  const problems: string[] = [];
  body.forEach((cells, index) => {
    const line = index + 2;
    if (rows.length >= MAX_IMPORT_ROWS) {
      if (problems.length === 0 || !problems[problems.length - 1].startsWith("Stopped"))
        problems.push(`Stopped after ${MAX_IMPORT_ROWS} rows. Split the file and import the rest.`);
      return;
    }
    const spentOn = parseFlexibleDate(cells[dateCol] ?? "");
    const category = (cells[categoryCol] ?? "").replace(/\s+/g, " ").trim();
    const amount = parseAmount(cells[amountCol] ?? "");
    const description = descriptionCol >= 0 ? (cells[descriptionCol] ?? "").trim() || null : null;
    if (!spentOn) {
      problems.push(`Line ${line}: the date "${cells[dateCol] ?? ""}" is not a date.`);
      return;
    }
    if (!category) {
      problems.push(`Line ${line}: no category.`);
      return;
    }
    if (category.length > 200) {
      problems.push(`Line ${line}: the category is longer than 200 characters.`);
      return;
    }
    if (amount === null) {
      problems.push(`Line ${line}: the amount "${cells[amountCol] ?? ""}" is not a number.`);
      return;
    }
    rows.push({
      line,
      spentOn,
      category,
      amount,
      description:
        description && description.length > 1000 ? description.slice(0, 1000) : description,
    });
  });
  return { rows, problems, columns: header };
}
