import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/soft-delete";
import { CLOSED_DEMAND_STATUSES } from "@/lib/constants";
import { ownedByUserOrAdmin, senderOwnedByUserOrAdmin, uploadedByUserOrAdmin } from "@/lib/tenant-scope";
import { getPeriodRange } from "@/lib/period-range";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

async function generateContentWithRetry(
  genAI: GoogleGenAI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: { model: string; contents: string | any[] },
  maxRetries = 3,
  delayMs = 1500
): Promise<{ text?: string }> {
  let lastError: unknown = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await (genAI.models.generateContent(options) as Promise<{ text?: string }>);
      return response;
    } catch (err) {
      lastError = err;
      const errStr = typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
      if (
        errStr.includes("503") ||
        errStr.includes("429") ||
        errStr.toLowerCase().includes("unavailable") ||
        errStr.toLowerCase().includes("high demand") ||
        errStr.toLowerCase().includes("overloaded") ||
        errStr.toLowerCase().includes("fetch failed")
      ) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export type ActionRecommendation = {
  area: "marketing" | "sales" | "appointments" | "general";
  severity: "urgent" | "warning" | "info";
  title: string;
  insight: string;
  action: string;
  actionType:
    | "view_quoted_deals"
    | "view_pending_deals"
    | "view_all_deals"
    | "view_overdue_followups"
    | "view_due_followups"
    | "view_missing_phone"
    | "set_target_modal"
    | "view_finance"
    | "general_dashboard";
};

// Heuristic fallback — always runs when Gemini is unavailable (Burmese output)
function buildHeuristicRecommendations(data: {
  highPriority: number;
  missingPhone: number;
  overdue: number;
  dueToday: number;
  closedDeals: number;
  pendingDeals: number;
  quotedDeals: number;
  newLeads: number;
  appointmentsMade: number;
  appointmentsKept: number;
  callsMade: number;
  totalSalesAmount: number;
  targetSalesAmount: number | null;
  elapsedRatio: number;
  }): ActionRecommendation[] {
  const recs: ActionRecommendation[] = [];

  // Revenue pacing check
  if (data.targetSalesAmount && data.elapsedRatio > 0.3) {
    const expectedRevenue = data.targetSalesAmount * data.elapsedRatio;
    const gap = expectedRevenue - data.totalSalesAmount;
    if (gap > 0) {
      const pct = Math.round((data.totalSalesAmount / expectedRevenue) * 100);
      recs.push({
        area: "sales",
        severity: pct < 60 ? "urgent" : "warning",
        title: "အရောင်းဝင်ငွေ နှောင့်နှေးနေသည်",
        insight: `ဝင်ငွေသည် မျှော်မှန်းထားသောနှုန်း၏ ${pct}% သာရှိသေးသည်။ ${Math.round(gap).toLocaleString()} Ks ကွာဟချက် ပြည့်မီရန် လိုနေသည်။`,
        action: "ဤကာလအတွင်း High-Potential Lead တွေနဲ့ Pending Deal တွေကို Sales Team ကို အာရုံစိုက်ပြီး ပိတ်ရန် အလျင်အမြန်ဆောင်ရွက်ပါ။",
        actionType: "view_all_deals",
      });
    }
  }

  // High-priority leads not being followed up
  if (data.highPriority > 5) {
    recs.push({
      area: "sales",
      severity: "urgent",
      title: `High-Potential Lead ${data.highPriority} ခု အာရုံစိုက်ရန် လိုသည်`,
      insight: `ဦးစားပေးရမည့် Open Lead ${data.highPriority} ခု ရှိနေသည်။ နောက်ကျလေ Close Rate ကျလေ ဖြစ်သည်။`,
      action: "ယနေ့ပင် High-Priority Lead တွေကို Sales Rep တွေ တာဝန်ပေးပြီး Demand Sheet မှာ ရလဒ်မှတ်ပါ။",
      actionType: "view_all_deals",
    });
  }

  // Missing phone numbers → marketing quality
  if (data.missingPhone > 3) {
    recs.push({
      area: "marketing",
      severity: "warning",
      title: "Lead ဖမ်းဆည်းမှု အရည်အသွေး တိုးတက်ရန် လိုသည်",
      insight: `ဖုန်းနံပါတ် မပါသော Open Lead ${data.missingPhone} ခု ရှိသဖြင့် ဆက်သွယ်မရနိုင်ပါ။`,
      action: "Marketing Team ကို Lead ကို Sales သို့ မပို့မီ ဖုန်းနံပါတ် ရယူရန် တာဝန်ပေးပါ။",
      actionType: "view_missing_phone",
    });
  }

  // Overdue follow-ups
  if (data.overdue > 0) {
    recs.push({
      area: "sales",
      severity: "urgent",
      title: `Follow-up ${data.overdue} ခု သက်တမ်းကျော်နေပြီ`,
      insight: "သက်တမ်းကျော် Follow-up ရှိနေခြင်းသည် Lead လက်ဆင့်ကမ်းမှုတွင် ချို့ယွင်းနေကြောင်း ညွှန်ပြသည်။",
      action: "သက်တမ်းကျော်နေသော List ကို အရင်ဆုံး ဆောင်ရွက်ပြီး ဖုန်းဆက်ပြီးတိုင်း Status အပ်ဒိတ်ပါ။",
      actionType: "view_overdue_followups",
    });
  } else if (data.dueToday > 0) {
    recs.push({
      area: "sales",
      severity: "warning",
      title: `ယနေ့ Follow-up လုပ်ရမည့်အရာ ${data.dueToday} ခု ရှိသည်`,
      insight: "ယနေ့ Follow-up တွေ Dashboard မှာ ရှိနေသည်။ ညနေမရောက်မီ ဆောင်ရွက်ပါ။",
      action: "ယနေ့ Follow-up ဖုန်းဆက်မှုများ ပြီးဆုံးပြီး ရလဒ်ကို Record တစ်ခုချင်းမှာ မှတ်တမ်းတင်ပါ။",
      actionType: "view_due_followups",
    });
  }

  // Low appointment show rate
  if (data.appointmentsMade > 0 && data.appointmentsKept < data.appointmentsMade * 0.5) {
    const showRate = Math.round((data.appointmentsKept / data.appointmentsMade) * 100);
    recs.push({
      area: "appointments",
      severity: showRate < 30 ? "urgent" : "warning",
      title: "Appointment လာရောက်နှုန်း နည်းနေသည်",
      insight: `Appointment ${data.appointmentsMade} ခုထဲမှ ${data.appointmentsKept} ခုသာ လာရောက်သည် (${showRate}%)။ Lead အရည်အသွေး ညံ့နေနိုင်သည်။`,
      action: "Lead Source ကို ပြန်စစ်ပြီး Appointment မချိန်းမီ Lead Qualify ကို ပိုတင်းကျပ်စွာ လုပ်ပါ။",
      actionType: "view_finance",
    });
  }

  // Low new leads from marketing
  if (data.callsMade > 0 && data.newLeads < data.callsMade * 0.1) {
    recs.push({
      area: "marketing",
      severity: "info",
      title: "Lead ထုတ်လုပ်နှုန်း နည်းနေသည်",
      insight: `ဖုန်းဆက် ${data.callsMade} ကြိမ်မှ New Lead ${data.newLeads} ခုသာ ရသည်။ Targeting ပြန်ပြင်ရန် လိုနိုင်သည်။`,
      action: "Outreach Lead အရည်အသွေး တိုးတက်ရန် Channel ကိုပြောင်း သို့မဟုတ် Message Angle အသစ် စမ်းကြည့်ပါ။",
      actionType: "view_finance",
    });
  }

  // Healthy fallback
  if (recs.length === 0) {
    recs.push({
      area: "general",
      severity: "info",
      title: "လုပ်ငန်းလည်ပတ်မှု ကောင်းနေသည်",
      insight: "လက်ရှိ Data များအရ အရေးပေါ် Bottleneck မတွေ့ရပါ။",
      action: "Demand Data ဆက်တင်သွင်းပြီး Follow-up တိုင်းတွင် ရက်ချိန်း သတ်မှတ်ထားရန် သေချာပါ။",
      actionType: "general_dashboard",
    });
  }

  const defaults: ActionRecommendation[] = [
    {
      area: "sales",
      severity: data.targetSalesAmount ? "info" : "warning",
      title: data.targetSalesAmount ? "အရောင်းပစ်မှတ်ကို နေ့စဉ်စောင့်ကြည့်ပါ" : "အရောင်းပစ်မှတ် သတ်မှတ်ရန် လိုသည်",
      insight: data.targetSalesAmount
        ? `လက်ရှိရောင်းရငွေ ${Math.round(data.totalSalesAmount).toLocaleString()} Ks ကို ပစ်မှတ်နှင့် နေ့စဉ်နှိုင်းယှဉ်ပြီး Sales လုပ်ဆောင်ချက်ကို ပြင်ဆင်ပါ။`
        : "Revenue၊ Expense၊ Demand နှင့် Appointment ပစ်မှတ်များ သတ်မှတ်ထားမှ လုပ်ငန်းစွမ်းဆောင်ရည်ကို မှန်ကန်စွာ တိုင်းတာနိုင်မည်ဖြစ်သည်။",
      action: data.targetSalesAmount ? "Sales Pipeline ကို စစ်ဆေးရန်" : "ပစ်မှတ်များ သတ်မှတ်ရန်",
      actionType: data.targetSalesAmount ? "view_all_deals" : "set_target_modal",
    },
    {
      area: "sales",
      severity: data.highPriority > 0 ? "warning" : "info",
      title: "High-Priority Lead များကို စီမံပါ",
      insight: data.highPriority > 0
        ? `High-Priority Open Lead ${data.highPriority} ခု ရှိနေသည်။ Owner နှင့် နောက်တစ်ကြိမ် Follow-up ရက်ကို တစ်ခုချင်းသတ်မှတ်ပါ။`
        : "High-Priority Open Lead မတွေ့ရသေးပါ။ Lead အသစ်များကို Priority နှင့် Follow-up ရက် ပြည့်စုံစွာ မှတ်တမ်းတင်ပါ။",
      action: "High-Priority Lead များ စစ်ဆေးရန်",
      actionType: "view_all_deals",
    },
    {
      area: "sales",
      severity: data.overdue > 0 ? "urgent" : data.dueToday > 0 ? "warning" : "info",
      title: "Follow-up အချိန်ဇယားကို ထိန်းသိမ်းပါ",
      insight: data.overdue > 0
        ? `သက်တမ်းကျော် Follow-up ${data.overdue} ခု ရှိနေသည်။ Lead မဆုံးရှုံးစေရန် အရင်ဆုံး ဆက်သွယ်ပါ။`
        : data.dueToday > 0
          ? `ယနေ့ ဆောင်ရွက်ရမည့် Follow-up ${data.dueToday} ခု ရှိသည်။ နေ့မကုန်မီ Status အပ်ဒိတ်ပါ။`
          : "သက်တမ်းကျော် Follow-up မရှိပါ။ Lead တိုင်းအတွက် နောက်တစ်ကြိမ် ဆက်သွယ်ရမည့်ရက် ဆက်လက်သတ်မှတ်ပါ။",
      action: "Follow-up စာရင်း စစ်ဆေးရန်",
      actionType: data.overdue > 0 ? "view_overdue_followups" : "view_due_followups",
    },
    {
      area: "marketing",
      severity: data.missingPhone > 0 ? "warning" : "info",
      title: "Lead Data အရည်အသွေးကို မြှင့်တင်ပါ",
      insight: data.missingPhone > 0
        ? `ဖုန်းနံပါတ် မပါသော Open Lead ${data.missingPhone} ခု ရှိသည်။ Sales မပို့မီ ဖုန်းနံပါတ်နှင့် လိုအပ်ချက်ကို ပြည့်စုံစွာ စုဆောင်းပါ။`
        : "Open Lead များ၏ ဖုန်းနံပါတ် မှတ်တမ်းကောင်းနေသည်။ Lead Source နှင့် Conversion ရလဒ်ကို ဆက်လက်စောင့်ကြည့်ပါ။",
      action: "Lead Data စစ်ဆေးရန်",
      actionType: "view_missing_phone",
    },
  ];

  for (const fallback of defaults) {
    if (recs.length >= 4) break;
    if (!recs.some((recommendation) => recommendation.actionType === fallback.actionType)) {
      recs.push(fallback);
    }
  }

  return recs.slice(0, 4);
}

// GET /api/dashboard/action-recommendations
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const { now, period, year, month, customStart, periodStart, periodEnd, startOfToday } =
    getPeriodRange(searchParams);
  const senderScope = senderOwnedByUserOrAdmin(session);
  const uploadedScope = uploadedByUserOrAdmin(session);
  const ownerScope = ownedByUserOrAdmin(session);
  const demandScope = { ...senderScope, ...notDeleted };
  const activeUploadedScope = { ...uploadedScope, ...notDeleted };

  try {
    const [
      settings,
      highPriorityCount,
      missingPhoneCount,
      overdueCount,
      dueTodayCount,
      dbClosedCount,
      dbQuotedCount,
      dbPendingCount,
      businessAgg,
      demandAgg,
      latestTargets,
    ] = await Promise.all([
      prisma.botSettings.findFirst({ where: { isActive: true, ...ownerScope }, select: { geminiApiKey: true, geminiModel: true } }),
      // Scoped to the selected period so May data doesn't bleed into June view
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
        where: {
          followUpDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) },
          ...demandScope,
          status: { notIn: CLOSED_DEMAND_STATUSES },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.demandRecord.count({
        where: {
          status: "closed",
          ...demandScope,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.demandRecord.count({
        where: {
          status: "quoted",
          ...demandScope,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.demandRecord.count({
        where: {
          status: "pending",
          ...demandScope,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.businessReport.aggregate({
        _sum: {
          totalSalesAmount: true,
          callsMade: true,
          appointmentsMade: true,
          appointmentsKept: true,
          newLeads: true,
          closedDeals: true,
          pendingDeals: true,
        },
        where: { reportDate: { gte: periodStart, lt: periodEnd }, ...activeUploadedScope },
      }),
      prisma.demandRecord.findMany({
        select: { serviceAmount: true, serviceQty: true },
        where: { createdAt: { gte: periodStart, lt: periodEnd }, ...demandScope },
      }),
      prisma.periodTarget.findFirst({
        where: (period === "day" || period === "custom")
          ? {
              period: "month",
              year: period === "custom" ? customStart.getUTCFullYear() : year,
              month: period === "custom" ? customStart.getUTCMonth() + 1 : month,
              ...ownerScope,
            }
          : {
              period,
              year,
              month: period === "year" ? 0 : month,
              ...ownerScope,
            },
      }),
    ]);

    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDaysInPeriod = Math.round((periodEnd.getTime() - periodStart.getTime()) / msPerDay);
    let elapsedDays = totalDaysInPeriod;
    if (now >= periodStart && now < periodEnd) {
      elapsedDays = Math.floor((startOfToday.getTime() - periodStart.getTime()) / msPerDay) + 1;
    } else if (periodStart > now) {
      elapsedDays = 0;
    }
    const elapsedRatio = period === "day" || period === "custom"
      ? 1
      : totalDaysInPeriod > 0
        ? elapsedDays / totalDaysInPeriod
        : 0;
    const periodLabel = period === "year" ? `${year}` : `${month}/${year}`;
    const targetLabel = period === "year" ? "ကာလပစ်မှတ်" : "လစဉ် အရောင်းပစ်မှတ်";

    const totalSalesAmount = (businessAgg._sum.totalSalesAmount ?? 0) + demandAgg.reduce(
      (total, record) => total + (record.serviceAmount ?? 0) * (record.serviceQty ?? 1),
      0,
    );

    const inputData = {
      highPriority: highPriorityCount,
      missingPhone: missingPhoneCount,
      overdue: overdueCount,
      dueToday: dueTodayCount,
      closedDeals: dbClosedCount,
      quotedDeals: dbQuotedCount,
      pendingDeals: dbPendingCount,
      newLeads: businessAgg._sum.newLeads ?? 0,
      appointmentsMade: businessAgg._sum.appointmentsMade ?? 0,
      appointmentsKept: businessAgg._sum.appointmentsKept ?? 0,
      callsMade: businessAgg._sum.callsMade ?? 0,
      totalSalesAmount,
      targetSalesAmount: latestTargets?.targetSalesAmount ?? null,
      elapsedRatio,
    };

    // Suggestions are intentionally generated from the current metrics only.
    // This keeps the output predictable and avoids any external AI request.
    return NextResponse.json({ recommendations: buildHeuristicRecommendations(inputData), source: "local" });
  } catch (err) {
    console.error("Action recommendations error:", err);
    return NextResponse.json({ recommendations: [] });
  }
}
