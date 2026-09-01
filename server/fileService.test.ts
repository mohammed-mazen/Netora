import { describe, expect, it } from "vitest";
import { validateUploadableFile } from "./fileService";

describe("tenant file upload validation", () => {
  it("accepts an allowed, bounded base64 text file", () => {
    expect(validateUploadableFile({ originalName: "customers.csv", mimeType: "text/csv", contentBase64: Buffer.from("name,phone\n").toString("base64"), category: "import" }).toString()).toContain("name,phone");
  });

  it("rejects unsupported types and unsafe file names before storage is called", () => {
    expect(() => validateUploadableFile({ originalName: "../secret.bin", mimeType: "application/octet-stream", contentBase64: "YQ==", category: "backup" })).toThrow();
  });
});
