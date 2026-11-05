import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notDeleted } from '@/lib/soft-delete';
import { customerOwnedByUserOrAdmin, senderOwnedByUserOrAdmin, uploadedByUserOrAdmin } from '@/lib/tenant-scope';
import { getPeriodRange } from '@/lib/period-range';

// Date coverage uses each page's reporting date, with the same ownership and
// soft-delete boundaries as its record APIs. Future records never extend Overall.
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const domain = req.nextUrl.searchParams.get('domain');
  if (!domain || !['finance', 'sales', 'customers', 'projects'].includes(domain)) {
    return NextResponse.json({ message: 'Invalid reporting domain' }, { status: 400 });
  }
  const { startOfToday, startOfTomorrow } = getPeriodRange(new URLSearchParams({ period: 'overall' }));
  const dates = { lt: startOfTomorrow };
  const uploaded = { ...uploadedByUserOrAdmin(session), ...notDeleted };
  const sender = { ...senderOwnedByUserOrAdmin(session), ...notDeleted };
  let starts: (Date | null)[];
  switch (domain) {
    case 'finance': {
      const [reports, demands, entries] = await Promise.all([
        prisma.businessReport.aggregate({ where: { ...uploaded, reportDate: dates, reporterName: { not: 'Daily Bot Ingestion' } }, _min: { reportDate: true } }),
        prisma.demandRecord.aggregate({ where: { ...sender, createdAt: dates, status: { in: ['closed', 'completed'] } }, _min: { createdAt: true } }),
        prisma.financeEntry.aggregate({ where: { ...uploaded, entryDate: dates, type: { not: 'owner_capital' } }, _min: { entryDate: true } }),
      ]);
      starts = [reports._min.reportDate, demands._min.createdAt, entries._min.entryDate];
      break;
    }
    case 'sales': {
      const demands = await prisma.demandRecord.aggregate({ where: { ...sender, createdAt: dates, reportType: 'demand_report' }, _min: { createdAt: true } });
      starts = [demands._min.createdAt];
      break;
    }
    case 'customers': {
      const [customers, demands] = await Promise.all([
        prisma.customer.aggregate({ where: { ...customerOwnedByUserOrAdmin(session), ...notDeleted, createdAt: dates }, _min: { createdAt: true } }),
        prisma.demandRecord.aggregate({ where: { ...sender, createdAt: dates, reportType: 'customer_service' }, _min: { createdAt: true } }),
      ]);
      starts = [customers._min.createdAt, demands._min.createdAt];
      break;
    }
    default: {
      const [projects, websites] = await Promise.all([
        prisma.projectExpiration.aggregate({ where: { ...uploaded, createdAt: dates }, _min: { createdAt: true } }),
        prisma.websiteUpdate.aggregate({ where: { ...uploaded, createdAt: dates }, _min: { createdAt: true } }),
      ]);
      starts = [projects._min.createdAt, websites._min.createdAt];
    }
  }
  const timestamps = starts.filter((date): date is Date => date !== null).map(date => date.getTime());
  return NextResponse.json({
    from: timestamps.length ? new Date(Math.min(...timestamps)).toISOString().slice(0, 10) : null,
    to: startOfToday.toISOString().slice(0, 10),
  });
}
