import { describe, expect, it } from "vitest";
import { addMoney, assertBalancedJournalLines, compareMoney, invoicePointsToAward } from "./financial";

describe("financial journal guards", () => {
  it("accepts a balanced double-entry posting in exact minor units", () => {
    expect(() => assertBalancedJournalLines([{ accountCode: "1100", debit: "19.99", credit: "0" }, { accountCode: "4100", debit: "0", credit: "19.99" }])).not.toThrow();
    expect(addMoney("10.10", "0.20")).toBe("10.30");
  });

  it("rejects unbalanced lines and prevents floating-point comparison mistakes", () => {
    expect(() => assertBalancedJournalLines([{ accountCode: "1100", debit: "10", credit: "0" }, { accountCode: "4100", debit: "0", credit: "9.99" }])).toThrow("غير متوازن");
    expect(compareMoney("10.00", "9.99")).toBe(1);
  });

  it("accepts the exact reversal entry used when a confirmed payment is refunded", () => {
    expect(() => assertBalancedJournalLines([
      { accountCode: "1100", debit: "25.50", credit: "0" },
      { accountCode: "1000", debit: "0", credit: "25.50" },
    ])).not.toThrow();
    expect(compareMoney(addMoney("74.50", "25.50"), "100.00")).toBe(0);
  });
});

describe("invoice points award", () => {
  it("awards floor of invoice total as points when enabled and amount meets minimum", () => {
    expect(invoicePointsToAward({ isEnabled: true, minimumAmount: "10.00", invoiceTotal: "19.99", customerId: 7 })).toEqual({
      points: 19,
      customerId: 7,
      kind: "earn",
    });
  });

  it("awards nothing when points are disabled or amount is below minimum or customer is missing", () => {
    expect(invoicePointsToAward({ isEnabled: false, minimumAmount: "10.00", invoiceTotal: "50.00", customerId: 7 })).toBeNull();
    expect(invoicePointsToAward({ isEnabled: true, minimumAmount: "20.00", invoiceTotal: "19.99", customerId: 7 })).toBeNull();
    expect(invoicePointsToAward({ isEnabled: true, minimumAmount: "0", invoiceTotal: "25.00", customerId: null })).toBeNull();
  });
});
