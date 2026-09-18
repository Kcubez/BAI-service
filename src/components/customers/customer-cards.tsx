'use client';
/** Customer metric + ranking cards. Extracted verbatim from the page. */
import {
  Skeleton,
} from '@/components/ui/skeleton';
import type {
  DollarSign,
} from 'lucide-react';
import type {
  CustomerAnalyticsMetric,
} from '@/lib/api';

export const leadStatusColors: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  contacted: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  quoted: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
  closed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};
export function CustomerMetricCard({ label, value, icon: Icon, tone, loading }: { label: string; value: number; icon: typeof DollarSign; tone: string; loading: boolean }) {
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 ${tone} bg-card p-4 dark:border-slate-800`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>{loading ? <Skeleton className="mt-2 h-6 w-28" /> : <p className="mt-2 text-xl font-black text-foreground">{Math.round(value).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">MMK</span></p>}</div>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
    </div>
  );
}
export function CustomerRanking({ title, items, loading, accent }: { title: string; items: CustomerAnalyticsMetric[]; loading: boolean; accent: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30"><h3 className={`text-sm font-bold ${accent}`}>{title}</h3><span className="text-[11px] text-muted-foreground">Spend · frequency · LTV</span></div>
      {loading ? <div className="space-y-3 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No customer spending data for this period.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-900">{items.slice(0, 5).map((customer, index) => <div key={customer.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-3"><span className="text-xs font-black text-slate-400">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{customer.name}</p><p className="truncate text-[11px] text-muted-foreground">{customer.purchaseFrequency} purchase{customer.purchaseFrequency === 1 ? '' : 's'} · LTV {Math.round(customer.lifetimeValue).toLocaleString()} MMK</p></div><p className="whitespace-nowrap text-sm font-bold text-foreground">{Math.round(customer.totalSpend).toLocaleString()}</p></div>)}</div>}
      {items.length > 5 && <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] font-semibold text-muted-foreground dark:border-slate-900">Showing 5 of {items.length} customers</p>}
    </div>
  );
}
