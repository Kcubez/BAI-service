import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPeriodRange } from '../period-range';

afterEach(() => vi.useRealTimers());

describe('Overall reporting range', () => {
  it('includes today but excludes future record dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T06:00:00Z'));
    const range = getPeriodRange(new URLSearchParams({ period: 'overall' }));
    expect(range.periodEnd.toISOString()).toBe('2026-11-06T00:00:00.000Z');
    expect(new Date('2026-11-05T23:59:59Z') < range.periodEnd).toBe(true);
    expect(new Date('3099-01-20T00:00:00Z') < range.periodEnd).toBe(false);
  });

  it('rolls over at the Myanmar calendar day boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T18:00:00Z'));
    const range = getPeriodRange(new URLSearchParams({ period: 'overall' }));
    expect(range.periodEnd.toISOString()).toBe('2027-01-02T00:00:00.000Z');
  });
});
