import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { dispatchSms, parseSmsGatewaySecret } from "./smsDispatch";

describe("smsDispatch", () => {
  it("parses JSON gateway secrets and falls back to a raw API key", () => {
    expect(parseSmsGatewaySecret('{"url":"https://sms.example/send","apiKey":"k1","from":"Netora"}')).toEqual({
      url: "https://sms.example/send",
      apiKey: "k1",
      from: "Netora",
    });
    expect(parseSmsGatewaySecret("plain-token")).toEqual({ apiKey: "plain-token", url: process.env.SMS_PROVIDER_URL });
  });

  it("refuses local modem and missing gateway configuration without throwing", async () => {
    const modem = await dispatchSms({ toNumber: "0500000000", body: "hi", serverType: "local_modem", secretValue: "k" });
    expect(modem.ok).toBe(false);
    expect(modem.retryable).toBe(false);
    expect(modem.error).toContain("المودم المحلي");

    const missingSecret = await dispatchSms({ toNumber: "0500000000", body: "hi", serverType: "cloud", secretValue: null });
    expect(missingSecret.ok).toBe(false);
    expect(missingSecret.retryable).toBe(false);

    const missingUrl = await dispatchSms({ toNumber: "0500000000", body: "hi", serverType: "cloud", secretValue: "token-only" });
    expect(missingUrl.ok).toBe(false);
    expect(missingUrl.retryable).toBe(false);
    expect(missingUrl.error).toContain("عنوان بوابة الرسائل");
  });

  it("POSTs to a real HTTP gateway and marks success or permanent failure from the status code", async () => {
    const received: Array<{ authorization?: string; body: string }> = [];
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk as Buffer));
      req.on("end", () => {
        received.push({ authorization: req.headers.authorization, body: Buffer.concat(chunks).toString("utf8") });
        const path = req.url ?? "/";
        if (path === "/fail") {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("rejected");
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: "msg-1" }));
      });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const ok = await dispatchSms({
        toNumber: "966500000000",
        body: "اختبار الإرسال",
        serverType: "cloud",
        secretValue: JSON.stringify({ url: `http://127.0.0.1:${port}/send`, apiKey: "test-key", from: "Netora" }),
      });
      expect(ok).toEqual({ ok: true, retryable: false });
      expect(received[0]?.authorization).toBe("Bearer test-key");
      expect(JSON.parse(received[0]?.body ?? "{}")).toMatchObject({ to: "966500000000", text: "اختبار الإرسال", from: "Netora" });

      const failed = await dispatchSms({
        toNumber: "966500000001",
        body: "fail",
        serverType: "cloud",
        secretValue: JSON.stringify({ url: `http://127.0.0.1:${port}/fail`, apiKey: "test-key" }),
      });
      expect(failed.ok).toBe(false);
      expect(failed.retryable).toBe(false);
      expect(failed.error).toContain("400");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
