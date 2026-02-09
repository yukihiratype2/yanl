import { compareAsc, format, isValid, parse } from "date-fns";

const FLEXIBLE_DATE_ONLY_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const CANONICAL_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseFlexibleDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  const match = FLEXIBLE_DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) return null;

  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const canonical = `${year}-${month}-${day}`;

  const parsed = parse(canonical, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return null;
  if (format(parsed, "yyyy-MM-dd") !== canonical) return null;
  return parsed;
}

export function normalizeDateOnly(value: string): string | null {
  const parsed = parseFlexibleDateOnly(value);
  if (!parsed) return null;
  return format(parsed, "yyyy-MM-dd");
}

export function isCanonicalDateOnly(value: string): boolean {
  if (!CANONICAL_DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return false;
  return format(parsed, "yyyy-MM-dd") === value;
}

export function parseCanonicalDateOnly(value: string): Date | null {
  if (!isCanonicalDateOnly(value)) return null;
  return parse(value, "yyyy-MM-dd", new Date());
}

export function todayLocalDateOnly(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function compareDateOnly(left: string, right: string): number | null {
  const leftDate = parseCanonicalDateOnly(left);
  const rightDate = parseCanonicalDateOnly(right);
  if (!leftDate || !rightDate) return null;
  return compareAsc(leftDate, rightDate);
}

export function isOnOrBeforeDateOnly(left: string, right: string): boolean | null {
  const comparison = compareDateOnly(left, right);
  if (comparison == null) return null;
  return comparison <= 0;
}
