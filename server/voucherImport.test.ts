import { describe, expect, it } from "vitest";
import { parseVoucherCsv, planVoucherInserts } from "./voucherImport";

describe("voucher CSV import", () => {
  it("accepts code,serial rows and counts invalid and duplicate codes", () => {
    const result = parseVoucherCsv([
      "code,serial",
      "ABCD1234,SER-0001",
      "WXYZ9876,SER-0002",
      "abcd1234,SER-0003",
      "xx,SER-0004",
      ",SER-0005",
    ].join("\n"));
    expect(result.accepted).toEqual([
      { code: "ABCD1234", serial: "SER-0001" },
      { code: "WXYZ9876", serial: "SER-0002" },
    ]);
    expect(result.duplicates).toBe(1);
    expect(result.rejected).toBe(2);
  });

  it("rejects empty files, missing headers, and more than 5000 data rows", () => {
    expect(() => parseVoucherCsv("")).toThrow("فارغ");
    expect(() => parseVoucherCsv("name,value\nABCD1234,x")).toThrow("code");
    const rows = ["code,serial", ...Array.from({ length: 5001 }, (_, i) => `CODE${String(i).padStart(4, "0")},S${i}`)];
    expect(() => parseVoucherCsv(rows.join("\n"))).toThrow("5000");
  });

  it("accepts a code-only CSV when serial is omitted", () => {
    const result = parseVoucherCsv("code\nCARDCODE01\nCARDCODE02");
    expect(result.accepted).toEqual([
      { code: "CARDCODE01" },
      { code: "CARDCODE02" },
    ]);
    expect(result.rejected).toBe(0);
    expect(result.duplicates).toBe(0);
  });

  it("builds serials and skips codes already present in the tenant", () => {
    const planned = planVoucherInserts({
      accepted: [
        { code: "ABCD1234", serial: "SER-0001" },
        { code: "WXYZ9876" },
        { code: "DUPCODE1" },
      ],
      existingCodeKeys: new Set(["dupcode1"]),
      existingSerials: new Set(["SER-0001"]),
      importReference: "IMP-ABC",
    });
    expect(planned.inserts).toEqual([
      { code: "WXYZ9876", serial: "IMP-ABC-0002" },
    ]);
    expect(planned.skippedExisting).toBe(1);
    expect(planned.serialConflicts).toBe(1);
  });
});
