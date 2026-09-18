/**
 * Customer resolution + activity logging for Telegram ingest.
 * Database access only. Extracted verbatim from the webhook route.
 */
import {
  prisma,
} from '@/lib/prisma';
import {
  restoreData,
} from '@/lib/soft-delete';
import {
  formatPhoneNumber,
} from '@/lib/utils';
import {
  isPrismaUniqueConstraintError,
  normalizeCustomerName,
} from '@/lib/telegram/senders';

export async function resolveCustomersBatch(
  parsedDemands: {
    customerName: string | null;
    customerPhone?: string | null;
    customerCompany?: string | null;
    createdAt?: Date | null;
  }[],
  senderId: string,
  fileName: string,
  ownerUserId: string | null,
): Promise<Map<string, string>> {
  const nameToNormalized = new Map<string, string>();
  const nameToDetails = new Map<string, { phone: string | null; company: string | null; createdAt: Date | null }>();

  for (const d of parsedDemands) {
    if (d.customerName) {
      const normalized = normalizeCustomerName(d.customerName);
      if (!nameToNormalized.has(d.customerName)) {
        nameToNormalized.set(d.customerName, normalized);
      }

      const existing = nameToDetails.get(d.customerName);
      const existingDate = existing?.createdAt ?? null;
      const newDate = d.createdAt ?? null;
      let earliestDate = existingDate;
      if (newDate) {
        if (!earliestDate || newDate < earliestDate) {
          earliestDate = newDate;
        }
      }

      nameToDetails.set(d.customerName, {
        phone: d.customerPhone ? formatPhoneNumber(d.customerPhone) : (existing ? existing.phone : null),
        company: d.customerCompany || (existing ? existing.company : null),
        createdAt: earliestDate,
      });
    }
  }
  if (nameToNormalized.size === 0) return new Map();

  const allNormalized = Array.from(new Set(nameToNormalized.values()));
  const allRawNames = Array.from(nameToNormalized.keys());

  const [byNormalizedRows, byRawNameRows] = await Promise.all([
    prisma.customer.findMany({
      where: { nameNormalized: { in: allNormalized }, userId: ownerUserId },
      select: { id: true, name: true, nameNormalized: true, deletedAt: true },
    }),
    prisma.customer.findMany({
      where: { name: { in: allRawNames }, userId: ownerUserId },
      select: { id: true, name: true, nameNormalized: true, deletedAt: true },
    }),
  ]);

  const idByNormalized = new Map<string, { id: string; name: string; nameNormalized: string | null; deletedAt?: Date | null }>();
  for (const c of byNormalizedRows) {
    if (c.nameNormalized) idByNormalized.set(c.nameNormalized, c);
  }
  for (const c of byRawNameRows) {
    if (c.nameNormalized) {
      if (!idByNormalized.has(c.nameNormalized)) idByNormalized.set(c.nameNormalized, c);
    } else {
      const targetNormalized = nameToNormalized.get(c.name);
      if (targetNormalized && !idByNormalized.has(targetNormalized)) {
        idByNormalized.set(targetNormalized, c);
      }
    }
  }

  const missingNames: { raw: string; normalized: string }[] = [];
  for (const [raw, normalized] of nameToNormalized.entries()) {
    if (!idByNormalized.has(normalized)) missingNames.push({ raw, normalized });
  }

  for (const m of missingNames) {
    try {
      const details = nameToDetails.get(m.raw);
      const created = await prisma.customer.create({
        data: {
          name: m.raw,
          userId: ownerUserId,
          nameNormalized: m.normalized,
          phone: details?.phone || null,
          company: details?.company || null,
          createdAt: details?.createdAt ?? undefined,
        },
        select: { id: true, name: true, nameNormalized: true, deletedAt: true },
      });
      idByNormalized.set(m.normalized, created);
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        const existing = await prisma.customer.findFirst({
          where: { nameNormalized: m.normalized, userId: ownerUserId },
          select: { id: true, name: true, nameNormalized: true, deletedAt: true },
        });
        if (existing) idByNormalized.set(m.normalized, existing);
      } else {
        throw err;
      }
    }
  }

  // Update details (phone, company) and backfill normalized name for existing/newly resolved customers
  await Promise.all(
    Array.from(idByNormalized.values()).map(async (c) => {
      const details = nameToDetails.get(c.name);
      if (!details) return;
      const updateData: {
        phone?: string;
        company?: string;
        nameNormalized?: string;
        updatedAt?: Date;
        status?: string;
        deletedAt?: null;
        deletedByUserId?: null;
        deletedReason?: null;
        restoredAt?: Date;
        restoredByUserId?: string | null;
      } = {};
      if (details.phone) {
        updateData.phone = details.phone;
      }
      if (details.company) {
        updateData.company = details.company;
      }
      const targetNormalized = nameToNormalized.get(c.name);
      if (targetNormalized && !c.nameNormalized) {
        updateData.nameNormalized = targetNormalized;
      }
      if (c.deletedAt && ownerUserId) {
        Object.assign(updateData, restoreData(ownerUserId), { status: "active" });
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();
        await prisma.customer.update({
          where: { id: c.id },
          data: updateData,
        });
      }
    })
  );

  const rawNameToId = new Map<string, string>();
  for (const [raw, normalized] of nameToNormalized.entries()) {
    const entry = idByNormalized.get(normalized);
    if (entry) rawNameToId.set(raw, entry.id);
  }

  const activityCreates = Array.from(rawNameToId.entries()).map(([raw, id]) => {
    const details = nameToDetails.get(raw);
    return {
      customerId: id,
      senderId,
      action: 'demand_report',
      description: `File: ${fileName}`,
      createdAt: details?.createdAt ?? undefined,
    };
  });
  if (activityCreates.length > 0) {
    await prisma.customerActivity.createMany({ data: activityCreates });
  }

  return rawNameToId;
}
