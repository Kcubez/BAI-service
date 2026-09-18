export type PeriodMode = "overall" | "year" | "custom" | "day" | "month";

export interface PeriodRange {
  now: Date;
  nowMyanmar: Date;
  period: PeriodMode;
  year: number;
  month: number;
  day: number;
  customStart: Date;
  customEndInclusive: Date;
  periodStart: Date;
  periodEnd: Date;
  startOfToday: Date;
  startOfTomorrow: Date;
  sevenDaysAgo: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shared dashboard period resolution (Myanmar-timezone aware).
 * Extracted verbatim from the previously copy-pasted blocks in
 * `dashboard/stats` and `dashboard/action-recommendations` — keep behavior identical.
 */
export function getPeriodRange(searchParams: URLSearchParams): PeriodRange {
  const now = new Date();
  const nowMyanmar = new Date(Date.now() + 6.5 * 60 * 60 * 1000);
  const period =
    searchParams.get("period") === "overall"
      ? "overall"
      : searchParams.get("period") === "day"
        ? "day"
        : searchParams.get("period") === "year"
          ? "year"
          : searchParams.get("period") === "custom"
            ? "custom"
            : "month";
  const monthParam = Number(searchParams.get("month") || nowMyanmar.getUTCMonth() + 1);
  const yearParam = Number(searchParams.get("year") || nowMyanmar.getUTCFullYear());
  const month = Math.min(12, Math.max(1, Number.isFinite(monthParam) ? monthParam : nowMyanmar.getUTCMonth() + 1));
  const year = Number.isFinite(yearParam) ? yearParam : nowMyanmar.getUTCFullYear();
  const dayParam = Number(searchParams.get("day") || nowMyanmar.getUTCDate());
  const day = Math.min(
    new Date(year, month, 0).getDate(),
    Math.max(1, Number.isFinite(dayParam) ? dayParam : nowMyanmar.getUTCDate()),
  );
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");
  const customStart = customFrom ? new Date(`${customFrom}T00:00:00.000Z`) : new Date(Date.UTC(year, month - 1, 1));
  const customEndInclusive = customTo ? new Date(`${customTo}T00:00:00.000Z`) : new Date(Date.UTC(year, month, 0));
  const periodStart =
    period === "overall"
      ? new Date(Date.UTC(1900, 0, 1))
      : period === "year"
        ? new Date(Date.UTC(year, 0, 1))
        : period === "custom"
          ? customStart
          : period === "day"
            ? new Date(Date.UTC(year, month - 1, day))
            : new Date(Date.UTC(year, month - 1, 1));
  const periodEnd =
    period === "overall"
      ? new Date(Date.UTC(9999, 11, 31))
      : period === "year"
        ? new Date(Date.UTC(year + 1, 0, 1))
        : period === "custom"
          ? new Date(customEndInclusive.getTime() + DAY_MS)
          : period === "day"
            ? new Date(Date.UTC(year, month - 1, day + 1))
            : new Date(Date.UTC(year, month, 1));
  const startOfToday = new Date(Date.UTC(nowMyanmar.getUTCFullYear(), nowMyanmar.getUTCMonth(), nowMyanmar.getUTCDate()));
  const startOfTomorrow = new Date(startOfToday.getTime() + DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  return {
    now,
    nowMyanmar,
    period,
    year,
    month,
    day,
    customStart,
    customEndInclusive,
    periodStart,
    periodEnd,
    startOfToday,
    startOfTomorrow,
    sevenDaysAgo,
  };
}
