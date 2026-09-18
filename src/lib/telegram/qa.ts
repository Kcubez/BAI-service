/**
 * Q&A context builder for the Telegram bot.
 * Database reads only. Extracted verbatim from the webhook route.
 */
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/soft-delete";

export async function buildQAContext(ownerUserId: string | null): Promise<string> {
  const [demandRecords, qaDocs, customers, projectExpiries, websiteUpdates, businessReports] = await Promise.all([
    prisma.demandRecord.findMany({
      where: { ...(ownerUserId ? { sender: { userId: ownerUserId } } : {}), ...notDeleted },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { sender: true },
    }),
    prisma.qADocument.findMany({
      where: ownerUserId ? { userId: ownerUserId } : {},
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.customer.findMany({
      where: { ...(ownerUserId ? { userId: ownerUserId } : {}), ...notDeleted },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.projectExpiration.findMany({
      where: { ...(ownerUserId ? { uploadedByUserId: ownerUserId } : {}), ...notDeleted },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.websiteUpdate.findMany({
      where: { ...(ownerUserId ? { uploadedByUserId: ownerUserId } : {}), ...notDeleted },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.businessReport.findMany({
      where: { ...(ownerUserId ? { sender: { userId: ownerUserId } } : {}), ...notDeleted },
      orderBy: { reportDate: 'desc' },
      take: 15,
      include: { sender: true },
    }),
  ]);

  const parts: string[] = [];

  if (demandRecords.length > 0) {
    parts.push('=== RECENT DEMAND SHEETS ===');
    for (const r of demandRecords) {
      const fields = [
        `Date: ${r.createdAt.toISOString().slice(0, 10)}`,
        `Reporter: ${r.sender?.displayName || "System / Uploaded"}`,
        r.customerName ? `Customer: ${r.customerName}` : 'Customer: —',
        r.serviceName ? `Service: ${r.serviceName} (Amount: ${r.serviceAmount ?? '—'}, Qty: ${r.serviceQty ?? '—'})` : 'Service: —',
        r.followUpDate ? `Follow-up Date: ${r.followUpDate.toISOString().slice(0, 10)}` : 'Follow-up: —',
        `Note: ${r.note || '—'}`,
      ].join(', ');
      parts.push(fields);
    }
  }

  if (businessReports.length > 0) {
    parts.push('\n=== BUSINESS ACTIVITY REPORTS ===');
    for (const br of businessReports) {
      const fields = [
        `Date: ${br.reportDate.toISOString().slice(0, 10)}`,
        br.reporterName ? `Reporter: ${br.reporterName}` : br.sender ? `Reporter: ${br.sender.displayName}` : '',
        br.marketingChannel ? `Channel: ${br.marketingChannel}` : '',
        br.marketingBudget != null ? `Budget: ${br.marketingBudget.toLocaleString()} Ks` : '',
        br.callsMade != null ? `Calls: ${br.callsMade}` : '',
        br.appointmentsMade != null ? `Appts Made: ${br.appointmentsMade}` : '',
        br.appointmentsKept != null ? `Appts Kept: ${br.appointmentsKept}` : '',
        br.newLeads != null ? `New Leads: ${br.newLeads}` : '',
        br.totalSalesAmount != null ? `Sales: ${br.totalSalesAmount.toLocaleString()} Ks` : '',
        br.closedDeals != null ? `Closed: ${br.closedDeals}` : '',
        br.pendingDeals != null ? `Pending: ${br.pendingDeals}` : '',
        br.notes ? `Notes: ${br.notes}` : '',
      ].filter(Boolean).join(', ');
      parts.push(fields);
    }
  }

  if (projectExpiries.length > 0) {
    parts.push('\n=== PROJECT EXPIRATIONS (DOMAINS & HOSTING) ===');
    for (const pe of projectExpiries) {
      const fields = [
        `Project: ${pe.projectName}`,
        pe.url ? `URL: ${pe.url}` : 'URL: —',
        pe.packageName ? `Package: ${pe.packageName}` : 'Package: —',
        pe.domainProvider ? `Domain Provider: ${pe.domainProvider}` : 'Domain Provider: —',
        pe.domainExpireDate ? `Domain Expiry: ${pe.domainExpireDate.toISOString().slice(0, 10)}` : 'Domain Expiry: —',
        pe.hostingProvider ? `Hosting Provider: ${pe.hostingProvider}` : 'Hosting Provider: —',
        pe.hostingExpireDate ? `Hosting Expiry: ${pe.hostingExpireDate.toISOString().slice(0, 10)}` : 'Hosting Expiry: —',
        pe.remark ? `Remark: ${pe.remark}` : '',
      ].filter(Boolean).join(', ');
      parts.push(fields);
    }
  }

  if (websiteUpdates.length > 0) {
    parts.push('\n=== WEBSITE MAINTENANCE & UPDATES ===');
    for (const wu of websiteUpdates) {
      const fields = [
        `Name: ${wu.name}`,
        wu.url ? `URL: ${wu.url}` : 'URL: —',
        wu.businessType ? `Business: ${wu.businessType}` : 'Business: —',
        wu.packageName ? `Package: ${wu.packageName}` : 'Package: —',
        `Status: ${wu.status}`,
        wu.remark ? `Remark: ${wu.remark}` : '',
      ].filter(Boolean).join(', ');
      parts.push(fields);
    }
  }

  if (qaDocs.length > 0) {
    parts.push('\n=== REFERENCE DOCUMENTS ===');
    for (const doc of qaDocs) {
      parts.push(`[${doc.title}]: ${doc.content.slice(0, 500)}`);
    }
  }

  if (customers.length > 0) {
    parts.push('\n=== CUSTOMERS ===');
    parts.push(customers.map(c => `${c.name} (${c.status})`).join(', '));
  }

  return parts.join('\n') || 'No business data available yet.';
}
