import { describe, expect, it } from "vitest";
import { buildRouterCommand, resolveMonitorActionCapability, summarizeMonitorActionResult } from "./monitorActions";

describe("monitor action command builder", () => {
  it("maps reboot to the RouterOS REST system/reboot endpoint", () => {
    expect(buildRouterCommand("reboot")).toEqual({ path: "/system/reboot", method: "POST" });
  });

  it("maps shutdown to the RouterOS REST system/shutdown endpoint", () => {
    expect(buildRouterCommand("shutdown")).toEqual({ path: "/system/shutdown", method: "POST" });
  });

  it("rejects unknown actions instead of building a command", () => {
    expect(() => buildRouterCommand("restart" as never)).toThrow(/غير معروف/);
  });
});

describe("monitor action capability guard", () => {
  it("allows reboot when the tenant enabled it", () => {
    expect(resolveMonitorActionCapability("reboot", { rebootable: true, shutdownable: false })).toEqual({ ok: true });
  });

  it("blocks reboot when the tenant disabled it", () => {
    const result = resolveMonitorActionCapability("reboot", { rebootable: false, shutdownable: true });
    expect(result.ok).toBe(false);
  });

  it("blocks shutdown when the tenant disabled it", () => {
    const result = resolveMonitorActionCapability("shutdown", { rebootable: true, shutdownable: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("الإيقاف");
  });
});

describe("monitor action result summarizer", () => {
  it("summarizes success as sent", () => {
    expect(summarizeMonitorActionResult({ ok: true })).toEqual({ status: "sent", errorMessage: null });
  });

  it("summarizes failure as failed with the router error", () => {
    expect(summarizeMonitorActionResult({ ok: false, error: "انتهت المهلة" })).toEqual({
      status: "failed",
      errorMessage: "انتهت المهلة",
    });
  });
});
