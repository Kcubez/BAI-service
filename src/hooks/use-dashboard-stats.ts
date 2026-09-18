/**
 * Dashboard overview stats query used by the demand-sheets workspace.
 * Extracted verbatim from the page.
 */
import {
  useQuery,
} from '@tanstack/react-query';

export type UpcomingRecord = {
  id: string;
  customerName: string | null;
  product: string | null;
  quantity: number | null;
  status: string;
  note: string;
  senderName: string;
  followUpDate: string | null;
};
export type DashboardStats = {
  totalMessages: number;
  todayMessages: number;
  totalSenders: number;
  weekMessages: number;
  todayDemandRecords: number;
  dueTodayFollowUps: number;
  pendingDemandRecords: number;
  totalCustomers: number;
  newCustomers: number;
  botActive: boolean;
  pipeline: {
    new: number;
    contacted: number;
    quoted: number;
    pending: number;
    closed: number;
  };
  totalQuantitySold: number;
  totalAmountSold: number;
  totalCost: number;
  actualDemandCount?: number;
  actualAppointments?: number;
  demandRevenue?: number;
  reportRevenue?: number;
  salesFunnel?: {
    leads: number;
    appointments: number;
    closedDeals: number;
    appointmentConversionRate: number | null;
    closeConversionRate: number | null;
  };
  weeklyActivity: {
    date: string;
    count: number;
  }[];
  upcomingRecords: UpcomingRecord[];
};
export function useDashboardStats(
  period: string,
  month: number,
  day: number,
  year: number,
  customFrom?: string,
  customTo?: string,
) {
  return useQuery({
    queryKey: ['dashboard-stats', period, month, day, year, customFrom, customTo],
    queryFn: async (): Promise<DashboardStats> => {
      const params = new URLSearchParams({
        period,
        month: String(month),
        day: String(day),
        year: String(year),
      });
      if (period === 'custom') {
        params.set('from', customFrom ?? '');
        params.set('to', customTo ?? '');
      }
      const res = await fetch(`/api/dashboard/stats?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
    refetchIntervalInBackground: false,
    refetchInterval: 60 * 1000,
  });
}
