import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { getPeriodRange } from "@/lib/period-range";
import { CLOSED_DEMAND_STATUSES } from "@/lib/constants";
import { convertBurmeseDigits } from "@/lib/text-normalize";
import {
  detectDemandColumnMapping,
  parseDemandRowsFromWorkbook,
} from "@/lib/demand-import";
import {
  isProjectExpiryHeaders,
  parseBusinessReportMessage,
  parseDemandMessage,
  parseExcelDate,
} from "@/lib/demand-parser";

describe("parseDemandMessage (heuristic fallback)", () => {
  it("extracts labeled English fields", () => {
    const record = parseDemandMessage(
      "Customer Name: Aung Aung\nPhone: 09123456789\nService Name: Web Design\nAmount: 500000",
    );
    expect(record.aiProvider).toBe("heuristic");
    expect(record.category).toBe("demand");
    expect(record.customerName).toMatch(/Aung Aung/);
    expect(record.customerPhone).toMatch(/09123456789/);
    expect(record.serviceName).toMatch(/Web Design/);
    expect(record.serviceAmount).toBe(500000);
    expect(record.confidence).toBeGreaterThan(0.35);
  });

  it("extracts Burmese digits for amounts", () => {
    const record = parseDemandMessage("Service: hosting\nAmount: ၅၀၀၀၀၀");
    expect(record.serviceAmount).toBe(500000);
  });

  it("returns the locked fallback shape for unparseable text", () => {
    const record = parseDemandMessage("just saying hello");
    expect(record).toMatchObject({
      customerName: null,
      customerPhone: null,
      serviceName: null,
      serviceAmount: null,
      status: "new",
      confidence: 0.35,
      aiProvider: "heuristic",
      note: "just saying hello",
    });
  });
});

describe("parseExcelDate", () => {
  it("handles nullish and empty input", () => {
    expect(parseExcelDate(null)).toBeNull();
    expect(parseExcelDate(undefined)).toBeNull();
    expect(parseExcelDate("")).toBeNull();
  });

  it("converts Excel serial numbers (day 25569 = 1970-01-01)", () => {
    expect(parseExcelDate(25569)?.toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  it("parses ISO strings and rejects garbage", () => {
    expect(parseExcelDate("2026-06-15")?.toISOString().slice(0, 10)).toBe("2026-06-15");
    expect(parseExcelDate("not a date")).toBeNull();
  });
});

describe("detectDemandColumnMapping", () => {
  it("maps English headers", () => {
    const mapping = detectDemandColumnMapping([
      "Customer Name",
      "Phone",
      "Service Amount",
      "Date",
    ]);
    expect(mapping.customerName).toBe("Customer Name");
    expect(mapping.customerPhone).toBe("Phone");
    expect(mapping.serviceAmount).toBe("Service Amount");
    expect(mapping.createdAt).toBe("Date");
  });

  it("maps Burmese headers", () => {
    const mapping = detectDemandColumnMapping(["သုံးစွဲသူ", "ဖုန်း", "ငွေပမာဏ", "ရက်စွဲ"]);
    expect(mapping.customerName).toBe("သုံးစွဲသူ");
    expect(mapping.customerPhone).toBe("ဖုန်း");
    expect(mapping.serviceAmount).toBe("ငွေပမာဏ");
    expect(mapping.createdAt).toBe("ရက်စွဲ");
  });

  it("leaves unknown headers unmapped", () => {
    expect(detectDemandColumnMapping(["Foo", "Bar"])).toEqual({});
  });
});

describe("parseDemandRowsFromWorkbook", () => {
  function workbookBuffer(rows: unknown[][]): Buffer {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push("Sheet1");
    wb.Sheets.Sheet1 = XLSX.utils.aoa_to_sheet(rows);
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  }

  it("parses an English-header sheet", () => {
    const { rows, columnMapping } = parseDemandRowsFromWorkbook(
      workbookBuffer([
        ["Customer Name", "Phone", "Service Amount"],
        ["Aung Aung", "09123456789", 500000],
      ]),
    );
    expect(columnMapping.customerName).toBe("Customer Name");
    expect(rows).toHaveLength(1);
    expect(rows[0].normalized.customerName).toMatch(/Aung Aung/);
    expect(rows[0].normalized.serviceAmount).toBe(500000);
  });

  it("parses a Burmese-header sheet", () => {
    const { rows } = parseDemandRowsFromWorkbook(
      workbookBuffer([
        ["သုံးစွဲသူ", "ဖုန်း"],
        ["မောင်မောင်", "09987654321"],
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].normalized.customerName).toMatch(/မောင်မောင်/);
  });
});

describe("parseBusinessReportMessage", () => {
  it("extracts sales figures from a labeled report", () => {
    const report = parseBusinessReportMessage(
      "Total Sales: 1500000\nMarketing Budget: 200000\nNew Leads: 12",
      new Date("2026-06-15T00:00:00.000Z"),
    );
    expect(report.totalSalesAmount).toBe(1500000);
    expect(report.marketingBudget).toBe(200000);
    expect(report.newLeads).toBe(12);
  });
});

describe("isProjectExpiryHeaders", () => {
  it("detects expiry templates and rejects demand sheets", () => {
    expect(isProjectExpiryHeaders(["Project", "Domain Expiration Date"])).toBe(true);
    expect(isProjectExpiryHeaders(["Customer Name", "Phone"])).toBe(false);
  });
});

describe("getPeriodRange", () => {
  function params(query: string): URLSearchParams {
    return new URLSearchParams(query);
  }

  it("resolves an explicit month", () => {
    const range = getPeriodRange(params("period=month&year=2026&month=6"));
    expect(range.period).toBe("month");
    expect(range.periodStart.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(range.periodEnd.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("resolves overall to sentinel bounds", () => {
    const range = getPeriodRange(params("period=overall"));
    expect(range.periodStart.getUTCFullYear()).toBe(1900);
    expect(range.periodEnd.getUTCFullYear()).toBe(9999);
  });

  it("resolves a single day and clamps invalid months", () => {
    const day = getPeriodRange(params("period=day&year=2026&month=6&day=15"));
    expect(day.periodStart.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(day.periodEnd.toISOString()).toBe("2026-06-16T00:00:00.000Z");
    const clamped = getPeriodRange(params("period=month&year=2026&month=99"));
    expect(clamped.month).toBe(12);
  });

  it("defaults unknown periods to month", () => {
    expect(getPeriodRange(params("period=bogus")).period).toBe("month");
    expect(getPeriodRange(params("")).period).toBe("month");
  });
});

describe("CLOSED_DEMAND_STATUSES", () => {
  it("covers both terminal statuses", () => {
    expect(CLOSED_DEMAND_STATUSES).toContain("closed");
    expect(CLOSED_DEMAND_STATUSES).toContain("completed");
  });
});

describe("convertBurmeseDigits", () => {
  it("converts Myanmar digits and leaves other text untouched", () => {
    expect(convertBurmeseDigits("၅၀၀၀၀၀")).toBe("500000");
    expect(convertBurmeseDigits("Amount: ၂၅၀၀၀ Ks")).toBe("Amount: 25000 Ks");
    expect(convertBurmeseDigits("no digits here")).toBe("no digits here");
    expect(convertBurmeseDigits("")).toBe("");
  });
});
