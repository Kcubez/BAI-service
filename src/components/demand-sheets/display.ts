/**
 * Demand-sheet display helpers: product classifier + badge color/label maps.
 * Pure constants extracted verbatim from the page.
 */
export function productTypeFor(name: string | null | undefined) {
  return /ebook|book|template|prompt pack|digital/i.test(name ?? '') ? 'Product' : 'Service';
}
export const statusColors: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  contacted: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
  quoted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  pending: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
  closed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  unknown: 'bg-muted text-muted-foreground border border-border',
};

export const categoryColors: Record<string, string> = {
  sales: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  inquiry: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  follow_up: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  general: 'bg-slate-500/10 text-muted-foreground border border-border',
};

export const statusLabels: Record<string, string> = {
  all: 'All Statuses',
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  pending: 'Pending',
  closed: 'Closed',
};

export const categoryLabels: Record<string, string> = {
  all: 'All Categories',
  sales: 'Sales',
  inquiry: 'Inquiry',
  follow_up: 'Follow-up',
  general: 'General',
};

export const priorityColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  low: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-border',
};

export const priorityLabels: Record<string, string> = {
  all: 'All Priority',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
