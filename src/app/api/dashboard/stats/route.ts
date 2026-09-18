import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/soft-delete";
import { CLOSED_DEMAND_STATUSES } from "@/lib/constants";
import {
  customerOwnedByUserOrAdmin,
  ownedByUserOrAdmin,
  senderOwnedByUserOrAdmin,
  uploadedByUserOrAdmin,
} from "@/lib/tenant-scope";
import { NextRequest, NextResponse } from "next/server";
import { getPeriodRange } from "@/lib/period-range";

// GET /api/dashboard/stats — dashboard overview stats
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const {
    now,
    nowMyanmar,
    period,
    year,
    month,
    day,
    periodStart,
    periodEnd,
    startOfToday,
    startOfTomorrow,
    sevenDaysAgo,
  } = getPeriodRange(searchParams);
  const senderScope = senderOwnedByUserOrAdmin(session);
  const ownerScope = ownedByUserOrAdmin(session);
  const customerScope = customerOwnedByUserOrAdmin(session);
  const uploadedScope = uploadedByUserOrAdmin(session);
  const demandScope = { ...senderScope, ...notDeleted };
  const activeCustomerScope = { ...customerScope, ...notDeleted };
  const activeUploadedScope = { ...uploadedScope, ...notDeleted };

  const [
    totalMessages,
    todayMessages,
    totalSenders,
    weekMessages,
    totalCustomers,
    newCustomers,
    botSettings,
    todayDemandRecords,
    pendingDemandRecords,
    ownerCapitalAgg,
    messages,
  ] = await Promise.all([
    prisma.telegramMessage.count({ where: senderScope }),
    prisma.telegramMessage.count({ where: { receivedAt: { gte: startOfToday }, ...senderScope } }),
    prisma.telegramSender.count({ where: ownerScope }),
    prisma.telegramMessage.count({ where: { receivedAt: { gte: sevenDaysAgo }, ...senderScope } }),
    prisma.customer.count({ where: activeCustomerScope }),
    prisma.customer.count({ where: { createdAt: { gte: periodStart, lt: periodEnd }, ...activeCustomerScope } }),
    prisma.botSettings.findFirst({ where: { isActive: true, ...ownerScope } }),
    prisma.demandRecord.count({ where: { createdAt: { gte: startOfToday }, ...demandScope } }),
    prisma.demandRecord.count({ where: { status: { notIn: ['closed', 'completed'] }, ...demandScope } }),
    // Lifetime owner capital (no period filter — matches /api/finance-entries).
    prisma.financeEntry.aggregate({
      _sum: { amount: true },
      where: { type: "owner_capital", ...activeUploadedScope },
    }),
    // Recent messages ride along in the same batch (only the 2 sender fields
    // the response uses — not the whole sender row).
    prisma.telegramMessage.findMany({
      where: senderScope,
      orderBy: { receivedAt: 'desc' },
      take: 5,
      include: { sender: { select: { displayName: true, username: true } } },
    }),
  ]);
  const ownerCapital = ownerCapitalAgg._sum.amount ?? 0;
  const recentMessages = messages.map(m => ({
    id: m.id,
    text: m.text.length > 80 ? m.text.slice(0, 80) + '...' : m.text,
    senderName: m.sender.displayName,
    senderUsername: m.sender.username,
    receivedAt: m.receivedAt.toISOString(),
  }));

  // Admin stats
  const isAdmin = session.user.role === 'admin';
  let adminStats = null;
  if (isAdmin) {
    const [totalUsers, activeSessions] = await Promise.all([
      prisma.user.count(),
      prisma.session.count({ where: { expiresAt: { gt: now } } }),
    ]);
    adminStats = { totalUsers, activeSessions };
  }

  // Daily and custom views use the full target of the selected calendar month.
  // For a custom range, its start date determines the calendar month.
  const targetReferenceDate = period === "day" || period === "custom" ? periodStart : null;

  // Quantity and Amount Aggregations — the pipeline groupBy and the period
  // target lookup are independent of these, so they ride in the same batch
  // instead of costing their own round-trips.
  const [pipelineCounts, demandRevenueRows, businessAgg, highPriorityLeads, missingPhoneLeads, overdueFollowUps, demandCountPeriod, periodTarget] = await Promise.all([
    prisma.demandRecord.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { createdAt: { gte: periodStart, lt: periodEnd }, ...demandScope },
    }),
    prisma.demandRecord.findMany({
      select: { serviceAmount: true, serviceQty: true },
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        ...demandScope,
        status: { in: ['closed', 'completed'] }
      },
    }),
    prisma.businessReport.aggregate({
      _sum: { 
        marketingBudget: true, 
        totalSalesAmount: true,
        callsMade: true,
        appointmentsMade: true,
        totalDemandCount: true,
        closedDeals: true
      },
      where: { 
        reportDate: { gte: periodStart, lt: periodEnd },
        ...activeUploadedScope,
      },
    }),
    prisma.demandRecord.count({
      where: {
        priority: "high",
        ...demandScope,
        status: { notIn: CLOSED_DEMAND_STATUSES },
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.demandRecord.count({
      where: {
        missingFields: { has: "phone" },
        ...demandScope,
        status: { notIn: CLOSED_DEMAND_STATUSES },
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.demandRecord.count({
      where: {
        followUpStatus: "overdue",
        ...demandScope,
        status: { notIn: CLOSED_DEMAND_STATUSES },
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    prisma.demandRecord.count({
      where: { createdAt: { gte: periodStart, lt: periodEnd }, reportType: "demand_report", ...demandScope },
    }),
    prisma.periodTarget.findFirst({
      where: targetReferenceDate
        ? {
            period: "month",
            year: targetReferenceDate.getUTCFullYear(),
            month: targetReferenceDate.getUTCMonth() + 1,
            ...ownerScope,
          }
        : { period, year, month: period === "year" ? 0 : month, ...ownerScope },
    }),
  ]);
  const pipeline = {
    new: 0,
    contacted: 0,
    quoted: 0,
    pending: 0,
    closed: 0,
  };
  for (const row of pipelineCounts) {
    const status = row.status as keyof typeof pipeline;
    if (status in pipeline) {
      pipeline[status] = row._count._all;
    }
  }
  const totalQuantitySold = demandRevenueRows.reduce(
    (total, record) => total + (record.serviceQty ?? 1),
    0,
  );
  const demandRevenue = demandRevenueRows.reduce(
    (total, record) => total + (record.serviceAmount ?? 0) * (record.serviceQty ?? 1),
    0,
  );
  const reportRevenue = businessAgg._sum.totalSalesAmount || 0;
  const totalAmountSold = reportRevenue + demandRevenue;
  const totalCost = businessAgg._sum.marketingBudget || 0;
  const profitLoss = totalAmountSold - totalCost;
  const roi = totalCost > 0 ? (profitLoss / totalCost) * 100 : null;

  const targetSalesAmount = periodTarget?.targetSalesAmount ?? null;
  const targetExpenseAmount = periodTarget?.targetExpenseAmount ?? null;
  const targetDemandCount = periodTarget?.targetDemandCount ?? null;
  const targetAppointments = periodTarget?.targetAppointments ?? null;
  const targetNewCustomers = periodTarget?.targetNewCustomers ?? null;

  // Pacing calculations
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDaysInPeriod = period === "overall" ? 0 : Math.round((periodEnd.getTime() - periodStart.getTime()) / msPerDay);

  let elapsedRatio = 1.0;
  let elapsedDays = period === "overall" ? 0 : totalDaysInPeriod;
  if (period !== "overall" && now >= periodStart && now < periodEnd) {
    elapsedDays = Math.floor((startOfToday.getTime() - periodStart.getTime()) / msPerDay) + 1;
    elapsedRatio = elapsedDays / totalDaysInPeriod;
  } else if (period !== "overall" && periodStart > now) {
    elapsedRatio = 0.0;
    elapsedDays = 0;
  }

  const actualDemandCount = demandCountPeriod;
  const actualAppointments = businessAgg._sum.appointmentsMade || 0;
  const closedDeals = businessAgg._sum.closedDeals || 0;
  const appointmentConversionRate = actualDemandCount > 0 ? (actualAppointments / actualDemandCount) * 100 : null;
  const closeConversionRate = actualAppointments > 0 ? (closedDeals / actualAppointments) * 100 : null;

  const targetPacingRatio = period === "day" || period === "custom" ? 1 : elapsedRatio;
  const expectedRevenue = targetSalesAmount !== null ? targetSalesAmount * targetPacingRatio : null;
  const expectedExpense = targetExpenseAmount !== null ? targetExpenseAmount * targetPacingRatio : null;
  const expectedDemandCount = targetDemandCount !== null ? targetDemandCount * targetPacingRatio : null;
  const expectedAppointments = targetAppointments !== null ? targetAppointments * targetPacingRatio : null;
  const expectedNewCustomers = targetNewCustomers !== null ? targetNewCustomers * targetPacingRatio : null;

  const alerts: {
    type: 'revenue_target' | 'demand_target' | 'appointments_target' | 'expense_target' | 'customers_target';
    status: 'warning' | 'info';
    message: string;
    actual: number;
    expected: number;
    target: number;
  }[] = [];

  if (targetSalesAmount && totalAmountSold < expectedRevenue!) {
    alerts.push({
      type: 'revenue_target',
      status: 'warning',
      message: `Sales Revenue is behind pacing target (${elapsedDays} of ${totalDaysInPeriod} days elapsed).`,
      actual: totalAmountSold,
      expected: expectedRevenue!,
      target: targetSalesAmount,
    });
  }

  if (targetExpenseAmount && totalCost > expectedExpense!) {
    alerts.push({
      type: 'expense_target',
      status: 'warning',
      message: `Marketing Expense is ahead of budget limit (${elapsedDays} of ${totalDaysInPeriod} days elapsed).`,
      actual: totalCost,
      expected: expectedExpense!,
      target: targetExpenseAmount,
    });
  }

  if (targetDemandCount && actualDemandCount < expectedDemandCount!) {
    alerts.push({
      type: 'demand_target',
      status: 'warning',
      message: `Demand leads count is behind pacing target (${elapsedDays} of ${totalDaysInPeriod} days elapsed).`,
      actual: actualDemandCount,
      expected: expectedDemandCount!,
      target: targetDemandCount,
    });
  }

  if (targetAppointments && actualAppointments < expectedAppointments!) {
    alerts.push({
      type: 'appointments_target',
      status: 'warning',
      message: `Appointments count is behind pacing target (${elapsedDays} of ${totalDaysInPeriod} days elapsed).`,
      actual: actualAppointments,
      expected: expectedAppointments!,
      target: targetAppointments,
    });
  }

  if (targetNewCustomers && newCustomers < expectedNewCustomers!) {
    alerts.push({
      type: 'customers_target',
      status: 'warning',
      message: `New customers count is behind pacing target (${elapsedDays} of ${totalDaysInPeriod} days elapsed).`,
      actual: newCustomers,
      expected: expectedNewCustomers!,
      target: targetNewCustomers,
    });
  }


  // Demand Activity (period-aware)
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
  };

  const demandActivityRows = await prisma.demandRecord.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: periodStart, lt: periodEnd }, ...demandScope },
    _count: { _all: true },
  });

  const weeklyActivity: { date: string; count: number }[] = [];

  const overallStartYear = 2020;
  const overallEndYear = nowMyanmar.getUTCFullYear();

  if (period === 'year') {
    // 12 monthly buckets
    const countsByMonth = new Map<string, number>();
    for (const row of demandActivityRows) {
      const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, '0')}`;
      countsByMonth.set(key, (countsByMonth.get(key) ?? 0) + row._count._all);
    }
    for (let i = 0; i < 12; i++) {
      const d = new Date(year, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en', { month: 'short' });
      weeklyActivity.push({ date: label, count: countsByMonth.get(key) ?? 0 });
    }
  } else if (period === 'overall') {
    const countsByYear = new Map<string, number>();
    for (const row of demandActivityRows) {
      const key = String(row.createdAt.getFullYear());
      countsByYear.set(key, (countsByYear.get(key) ?? 0) + row._count._all);
    }
    for (let currentYear = overallStartYear; currentYear <= overallEndYear; currentYear++) {
      weeklyActivity.push({ date: String(currentYear), count: countsByYear.get(String(currentYear)) ?? 0 });
    }
  } else {
    // Daily buckets for a month, a single day, or an explicit custom range.
    const countsByDay = new Map<string, number>();
    for (const row of demandActivityRows) {
      const key = formatLocalDate(row.createdAt);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + row._count._all);
    }
    const bucketDays = period === 'day' ? 1 : totalDaysInPeriod;
    for (let i = 0; i < bucketDays; i++) {
      const d = period === 'custom' ? new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000) : new Date(year, month - 1, period === 'day' ? day : i + 1);
      const key = formatLocalDate(d);
      weeklyActivity.push({ date: key, count: countsByDay.get(key) ?? 0 });
    }
  }

  // Financial Trend
  const trendBucketCount = period === "overall" ? overallEndYear - overallStartYear + 1 : period === "year" ? 12 : period === "day" ? 1 : totalDaysInPeriod;
  const trendBuckets = Array.from({ length: trendBucketCount }).map((_, index) => {
    const date = period === "overall" ? new Date(overallStartYear + index, 0, 1) : period === "year" ? new Date(year, index, 1) : period === "custom" ? new Date(periodStart.getTime() + index * 24 * 60 * 60 * 1000) : new Date(year, month - 1, period === "day" ? day : index + 1);
    const key = period === "overall"
      ? String(date.getFullYear())
      : period === "year"
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : formatLocalDate(date);
    const label = period === "overall"
      ? String(date.getFullYear())
      : period === "year"
      ? date.toLocaleDateString("en", { month: "short" })
      : period === "day" || period === "custom" ? date.toLocaleDateString("en", { month: "short", day: "numeric" }) : String(index + 1);
    return {
      key,
      label,
      revenueFromDemand: 0,
      revenueFromReports: 0,
      expense: 0,
      demand: 0,
    };
  });
  const trendByKey = new Map(trendBuckets.map((bucket) => [bucket.key, bucket]));
  const trendKey = (date: Date) => period === "overall"
    ? String(date.getFullYear())
    : period === "year"
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : formatLocalDate(date);

  const [trendDemandRows, trendBusinessRows] = await Promise.all([
    prisma.demandRecord.findMany({
      where: { createdAt: { gte: periodStart, lt: periodEnd }, reportType: "demand_report", ...demandScope },
      select: { createdAt: true, serviceAmount: true, serviceQty: true },
    }),
    prisma.businessReport.findMany({
      where: { reportDate: { gte: periodStart, lt: periodEnd }, ...activeUploadedScope },
      select: { reportDate: true, totalSalesAmount: true, marketingBudget: true },
    }),
  ]);

  for (const row of trendDemandRows) {
    const bucket = trendByKey.get(trendKey(row.createdAt));
    if (bucket) {
      bucket.revenueFromDemand += (row.serviceAmount || 0) * (row.serviceQty || 1);
      bucket.demand += 1;
    }
  }
  for (const row of trendBusinessRows) {
    const bucket = trendByKey.get(trendKey(row.reportDate));
    if (bucket) {
      bucket.revenueFromReports += row.totalSalesAmount || 0;
      bucket.expense += row.marketingBudget || 0;
    }
  }
  const financialTrend = trendBuckets.map((bucket) => {
    const revenue = bucket.revenueFromDemand + bucket.revenueFromReports;
    return {
      label: bucket.label,
      revenue,
      expense: bucket.expense,
      demand: bucket.demand,
      profit: revenue - bucket.expense,
    };
  });

  // Top Services — one query only. Grouping plus the qty/revenue math happen
  // in JS so SUM(amount * qty) stays exact, which Prisma aggregate cannot
  // express. Output (count, totalQty, revenue, sort, top 5) is unchanged.
  const serviceRows = await prisma.demandRecord.findMany({
    where: {
      serviceName: { not: null },
      status: { in: ['closed', 'completed'] },
      createdAt: { gte: periodStart, lt: periodEnd },
      ...demandScope,
    },
    select: { serviceName: true, serviceAmount: true, serviceQty: true },
  });
  const serviceAgg = new Map<string, { count: number; totalQty: number; revenue: number }>();
  for (const row of serviceRows) {
    if (!row.serviceName) continue;
    const entry = serviceAgg.get(row.serviceName) ?? { count: 0, totalQty: 0, revenue: 0 };
    entry.count += 1;
    entry.totalQty += row.serviceQty ?? 1;
    entry.revenue += (row.serviceAmount ?? 0) * (row.serviceQty ?? 1);
    serviceAgg.set(row.serviceName, entry);
  }
  const topProducts = [...serviceAgg.entries()].map(([product, v]) => ({
    product,
    count: v.count,
    totalQty: v.totalQty,
    revenue: v.revenue,
  })).sort((a, b) => b.revenue - a.revenue || b.count - a.count).slice(0, 5);

  // Due Today + Upcoming follow-ups in one batch (only the sender field the
  // response uses — not the whole sender row).
  const [dueTodayRecordsRaw, upcomingRecordsRaw] = await Promise.all([
    prisma.demandRecord.findMany({
    where: {
      followUpDate: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
      ...demandScope,
    },
    select: {
      id: true,
      customerName: true,
      serviceName: true,
      serviceQty: true,
      status: true,
      note: true,
      followUpDate: true,
      sender: { select: { displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    }),
    prisma.demandRecord.findMany({
    where: {
      followUpDate: {
        gte: startOfToday,
      },
      ...demandScope,
      status: { notIn: ['closed', 'completed'] },
    },
    select: {
      id: true,
      customerName: true,
      serviceName: true,
      serviceQty: true,
      status: true,
      note: true,
      followUpDate: true,
      sender: { select: { displayName: true } },
    },
    orderBy: { followUpDate: 'asc' },
    take: 10,
    }),
  ]);
  const dueTodayRecords = dueTodayRecordsRaw.map(r => ({
    id: r.id,
    customerName: r.customerName,
    product: r.serviceName,
    quantity: r.serviceQty,
    status: r.status,
    note: r.note,
    senderName: r.sender?.displayName || "System / Uploaded",
    followUpDate: r.followUpDate ? r.followUpDate.toISOString() : null,
  }));
  const dueTodayFollowUps = dueTodayRecords.length;

  const upcomingRecords = upcomingRecordsRaw.map(r => ({
    id: r.id,
    customerName: r.customerName,
    product: r.serviceName,
    quantity: r.serviceQty,
    status: r.status,
    note: r.note,
    senderName: r.sender?.displayName || "System / Uploaded",
    followUpDate: r.followUpDate ? r.followUpDate.toISOString() : null,
  }));

  return NextResponse.json({
    totalMessages,
    todayMessages,
    totalSenders,
    weekMessages,
    todayDemandRecords,
    dueTodayFollowUps,
    pendingDemandRecords,
    totalCustomers,
    newCustomers,
    botActive: !!botSettings,
    recentMessages,
    isAdmin,
    adminStats,
    pipeline,
    totalQuantitySold,
    totalAmountSold,
    totalCost,
    profitLoss,
    roi,
    ownerCapital,
    demandRevenue,
    reportRevenue,
    period,
    selectedMonth: month,
    selectedYear: year,
    highPriorityLeads,
    missingPhoneLeads,
    weeklyActivity,
    topProducts,
    financialTrend,
    salesFunnel: {
      leads: actualDemandCount,
      appointments: actualAppointments,
      closedDeals,
      appointmentConversionRate,
      closeConversionRate,
    },
    risks: {
      overdueFollowUps,
      highPriorityLeads,
      missingPhoneLeads,
      dueTodayFollowUps,
    },
    dueTodayRecords,
    upcomingRecords,
    targetDemandCount,
    targetAppointments,
    targetSalesAmount,
    targetExpenseAmount,
    targetNewCustomers,
    actualRevenue: totalAmountSold,
    actualDemandCount,
    actualAppointments,
    expectedRevenue,
    expectedExpense,
    expectedDemandCount,
    expectedAppointments,
    expectedNewCustomers,
    elapsedRatio,
    elapsedDays,
    totalDaysInPeriod,
    alerts,
  });
}
