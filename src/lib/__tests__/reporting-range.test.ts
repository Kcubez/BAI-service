import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  demand: vi.fn(),
  report: vi.fn(),
  entry: vi.fn(),
  customer: vi.fn(),
  project: vi.fn(),
  website: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  demandRecord: { aggregate: mocks.demand }, businessReport: { aggregate: mocks.report },
  financeEntry: { aggregate: mocks.entry }, customer: { aggregate: mocks.customer },
  projectExpiration: { aggregate: mocks.project }, websiteUpdate: { aggregate: mocks.website },
} }));
import { GET } from '@/app/api/reporting-range/route';

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T06:00:00Z'));
  mocks.session.mockResolvedValue({ user: { id: 'owner-1', role: 'user' } });
});
afterEach(() => vi.useRealTimers());
const request = (domain: string) => new NextRequest(`http://localhost/api/reporting-range?domain=${domain}`);

describe('Reporting date coverage', () => {
  it('requires a session and rejects unknown domains', async () => {
    mocks.session.mockResolvedValueOnce(null);
    expect((await GET(request('sales'))).status).toBe(401);
    expect((await GET(request('unknown'))).status).toBe(400);
    expect(mocks.demand).not.toHaveBeenCalled();
  });

  it('scopes sales coverage to owned active demand reports through today', async () => {
    mocks.demand.mockResolvedValue({ _min: { createdAt: new Date('2024-02-03T12:00:00Z') } });
    expect(await (await GET(request('sales'))).json()).toEqual({ from: '2024-02-03', to: '2026-11-05' });
    expect(mocks.demand).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      sender: { userId: 'owner-1' }, reportType: 'demand_report',
      deletedAt: null, createdAt: { lt: new Date('2026-11-06T00:00:00Z') },
    }) }));
  });

  it('uses the earliest project or website record rather than expiry dates', async () => {
    mocks.project.mockResolvedValue({ _min: { createdAt: new Date('2025-04-01T00:00:00Z') } });
    mocks.website.mockResolvedValue({ _min: { createdAt: new Date('2023-09-12T00:00:00Z') } });
    expect(await (await GET(request('projects'))).json()).toEqual({ from: '2023-09-12', to: '2026-11-05' });
    expect(mocks.project).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ uploadedByUserId: 'owner-1', deletedAt: null }) }));
  });

  it('returns no start date for an empty domain', async () => {
    mocks.demand.mockResolvedValue({ _min: { createdAt: null } });
    expect(await (await GET(request('sales'))).json()).toEqual({ from: null, to: '2026-11-05' });
  });
});
