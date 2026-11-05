import { useQuery } from '@tanstack/react-query';
import { reportingRangeApi, type ReportingDomain } from '@/lib/api';

export const reportingRangeKeys = {
  all: ['reporting-range'] as const,
  domain: (domain?: ReportingDomain, today?: string) => [...reportingRangeKeys.all, domain, today] as const,
};

export function useReportingRange(domain?: ReportingDomain, enabled = false, today?: string) {
  return useQuery({
    queryKey: reportingRangeKeys.domain(domain, today),
    queryFn: () => reportingRangeApi.get(domain!),
    enabled: Boolean(domain) && enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
