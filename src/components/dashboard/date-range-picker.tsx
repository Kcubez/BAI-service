'use client';

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { addDays, addMonths, endOfMonth, format, isValid, parseISO, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useReportingRange } from '@/hooks/use-reporting-range';
import type { ReportingDomain } from '@/lib/api';
import type { PeriodMode } from '@/hooks/use-date-filter';

type Selection = { period: PeriodMode; month?: number; year?: number; day?: number; customFrom?: string; customTo?: string };
type Props = {
  domain?: ReportingDomain;
  period: PeriodMode;
  from: string;
  to: string;
  coverage?: { from: string | null; to: string | null };
  onApply: (selection: Selection) => void;
};

const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
const presets = ['Today', 'Yesterday', 'Last 7 days', 'This month', 'Last month', 'This year', 'Overall', 'Custom range'] as const;
type Preset = typeof presets[number];

function initialPreset(period: PeriodMode): Preset {
  return period === 'overall' ? 'Overall' : period === 'month' ? 'This month' : period === 'year' ? 'This year' : 'Custom range';
}

function CalendarMonth({ month, from, to, onSelect }: {
  month: Date; from: string; to: string; onSelect: (date: string) => void;
}) {
  const start = startOfMonth(month);
  const days = endOfMonth(month).getDate();
  return (
    <div className="min-w-0 flex-1">
      <h3 className="mb-4 text-center text-sm font-semibold">{format(month, 'MMMM yyyy')}</h3>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="pb-2 text-[11px] font-medium text-muted-foreground">{day}</span>)}
        {Array.from({ length: start.getDay() }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = dateKey(addDays(start, i));
          const endpoint = date === from || date === to;
          const between = from && to && date > from && date < to;
          return (
            <button key={date} type="button" aria-label={format(parseISO(date), 'EEEE, d MMMM yyyy')} aria-pressed={Boolean(endpoint || between)}
              onClick={() => onSelect(date)}
              className={`h-10 sm:h-8 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${endpoint ? 'rounded-md bg-primary font-semibold text-primary-foreground' : between ? 'bg-primary/10 text-primary' : 'rounded-md text-foreground hover:bg-muted'}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({ period, from, to, coverage, domain, onApply }: Props) {
  const { data: domainCoverage, isPending: coveragePending, isError: coverageError } = useReportingRange(domain, period === 'overall' && !coverage, to);
  const overallCoverage = coverage ?? domainCoverage;
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [preset, setPreset] = useState<Preset>('Custom range');
  const [month, setMonth] = useState(() => startOfMonth(from ? parseISO(from) : new Date()));
  const [selectingEnd, setSelectingEnd] = useState(false);
  const valid = Boolean(draftFrom && draftTo && isValid(parseISO(draftFrom)) && isValid(parseISO(draftTo)) && draftFrom <= draftTo);
  const shownFrom = period === 'overall' ? overallCoverage?.from : from;
  const shownTo = period === 'overall' ? overallCoverage?.to : to;
  let label = period === 'overall' ? (domain && !overallCoverage ? (coverageError ? 'Overall · Dates unavailable' : coveragePending ? 'Overall · Loading dates…' : 'Overall') : overallCoverage && !overallCoverage.from ? 'Overall · No records yet' : 'Overall') : 'Select dates';
  if (shownFrom && shownTo) {
    const start = parseISO(shownFrom);
    const end = parseISO(shownTo);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    const range = shownFrom === shownTo ? format(start, 'd MMM yyyy')
      : `${format(start, sameMonth ? 'd' : sameYear ? 'd MMM' : 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
    label = `${period === 'overall' ? 'Overall · ' : ''}${range}`;
  }

  const choosePreset = (next: Preset) => {
    setPreset(next);
    setSelectingEnd(false);
    if (next === 'Overall' || next === 'Custom range') return;
    const today = new Date();
    const start = next === 'Yesterday' ? subDays(today, 1) : next === 'Last 7 days' ? subDays(today, 6) : next === 'This month' ? startOfMonth(today) : next === 'Last month' ? startOfMonth(subMonths(today, 1)) : next === 'This year' ? startOfYear(today) : today;
    const end = next === 'This month' ? endOfMonth(today) : next === 'Last month' ? endOfMonth(subMonths(today, 1)) : next === 'This year' ? new Date(today.getFullYear(), 11, 31) : next === 'Yesterday' ? start : today;
    setDraftFrom(dateKey(start));
    setDraftTo(dateKey(end));
    setMonth(startOfMonth(start));
  };

  const selectDate = (date: string) => {
    setPreset('Custom range');
    if (!selectingEnd || date < draftFrom) {
      setDraftFrom(date);
      setDraftTo('');
      setSelectingEnd(true);
    } else {
      setDraftTo(date);
      setSelectingEnd(false);
    }
  };

  const apply = () => {
    if (preset === 'Overall') onApply({ period: 'overall' });
    else if (valid) {
      const start = parseISO(draftFrom);
      const isFullMonth = draftFrom === dateKey(startOfMonth(start)) && draftTo === dateKey(endOfMonth(start));
      if (isFullMonth) {
        onApply({ period: 'month', month: start.getMonth() + 1, year: start.getFullYear() });
      } else if (preset === 'This year') onApply({ period: 'year', year: start.getFullYear() });
      else if (draftFrom === draftTo) onApply({ period: 'day', year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() });
      else onApply({ period: 'custom', customFrom: draftFrom, customTo: draftTo });
    } else return;
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={next => {
      if (next) {
        setDraftFrom(from); setDraftTo(to);
        // Historical months/years are custom selections, not relative presets.
        const today = new Date();
        const currentMonth = from === dateKey(startOfMonth(today));
        const currentYear = from === dateKey(startOfYear(today));
        setPreset((period === 'month' && !currentMonth) || (period === 'year' && !currentYear) ? 'Custom range' : initialPreset(period));
        setMonth(startOfMonth(from ? parseISO(from) : new Date()));
        setSelectingEnd(false);
      }
      setOpen(next);
    }}>
      <Popover.Trigger render={<Button variant="outline" className="h-10 min-w-0 max-w-full gap-2 bg-card px-3 text-sm font-medium shadow-none" />}>
        <CalendarDays className="h-4 w-4 text-muted-foreground" /><span className="truncate">{label}</span><ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="w-[min(720px,calc(100vw-32px))] max-h-[min(85dvh,var(--available-height))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none">
            <Popover.Title className="sr-only">Choose reporting dates</Popover.Title>
            <div className="flex flex-col sm:flex-row">
              <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-border bg-muted/25 p-2 sm:flex sm:w-40 sm:flex-col sm:gap-0.5 sm:border-b-0 sm:border-r" role="group" aria-label="Date presets">
                {presets.map(item => <button key={item} type="button" aria-pressed={preset === item} onClick={() => choosePreset(item)}
                  className={`flex h-10 w-full items-center sm:h-9 justify-between rounded-md px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${preset === item ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  {item}{preset === item && <Check className="h-3.5 w-3.5" />}
                </button>)}
              </div>
              <div className="min-w-0 flex-1 p-4 sm:p-5">
                {preset === 'Overall' ? <div className="flex min-h-72 flex-col items-center justify-center gap-2 text-center"><CalendarDays className="mb-2 h-7 w-7 text-primary" /><p className="text-sm font-semibold">All recorded activity</p><p className="max-w-64 text-xs leading-relaxed text-muted-foreground">Include your recorded business activity through today.</p></div> : <>
                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Start date<Input type="date" value={draftFrom} onChange={e => { setDraftFrom(e.target.value); setPreset('Custom range'); setSelectingEnd(false); }} className="h-10 min-w-0 w-full bg-card text-foreground sm:h-9" /></label>
                    <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">End date<Input type="date" value={draftTo} min={draftFrom} onChange={e => { setDraftTo(e.target.value); setPreset('Custom range'); setSelectingEnd(false); }} className="h-10 min-w-0 w-full bg-card text-foreground sm:h-9" /></label>
                  </div>
                  <div className="relative">
                    <button type="button" aria-label="Previous month" onClick={() => setMonth(subMonths(month, 1))} className="absolute -left-1 -top-1 rounded-md p-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className="absolute -right-1 -top-1 rounded-md p-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="h-4 w-4" /></button>
                    <div className="flex gap-5">
                      <CalendarMonth month={month} from={draftFrom} to={draftTo} onSelect={selectDate} />
                      <div className="hidden min-w-0 flex-1 sm:block"><CalendarMonth month={addMonths(month, 1)} from={draftFrom} to={draftTo} onSelect={selectDate} /></div>
                    </div>
                  </div>
                  <p className="mt-3 min-h-4 text-xs text-muted-foreground" aria-live="polite">{selectingEnd ? 'Select an end date.' : !valid ? 'Choose a valid start and end date.' : 'Both dates are included.'}</p>
                </>}
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-popover px-4 py-3">
              <span className="text-xs text-muted-foreground"><span className="hidden sm:inline">Reporting timezone: </span>UTC</span>
              <div className="flex gap-2"><Popover.Close render={<Button variant="ghost" className="h-10 sm:h-8" />}>Cancel</Popover.Close><Button className="h-10 sm:h-8" onClick={apply} disabled={preset !== 'Overall' && !valid}>Apply</Button></div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
