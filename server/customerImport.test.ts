import { describe, expect, it } from "vitest";
import { parseCustomerCsv } from "./customerImport";

describe("customer CSV import", () => {
  it("accepts explicit two-column customer records and rejects malformed rows", () => {
    expect(parseCustomerCsv('full_name,username\n"شركة، فرع أ",branch-a\nX,no space').accepted).toEqual([{ fullName: "شركة، فرع أ", username: "branch-a" }]);
    expect(parseCustomerCsv('full_name,username\n"شركة، فرع أ",branch-a\nX,no space').rejected).toBe(1);
  });
  it("requires a strict header", () => expect(() => parseCustomerCsv("name,user\nA,foo")).toThrow("full_name,username"));
});
