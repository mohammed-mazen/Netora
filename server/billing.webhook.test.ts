import { describe, expect, it } from "vitest";
import { processWebhookEventIdempotently } from "./db";

describe("Webhook Idempotency", () => {
  it("processes a new event exactly once and ignores duplicates", async () => {
    let callCount = 0;
    const provider = "test_provider";
    const eventId = `evt_${Date.now()}`;
    const payload = JSON.stringify({ amount: 100 });

    const handler = async () => {
      callCount++;
    };

    // First call should process
    const firstResult = await processWebhookEventIdempotently(provider, eventId, payload, handler);
    expect(firstResult).toBe(true);
    expect(callCount).toBe(1);

    // Second call with same provider/eventId should be ignored
    const secondResult = await processWebhookEventIdempotently(provider, eventId, payload, handler);
    expect(secondResult).toBe(false);
    expect(callCount).toBe(1); // handler was NOT called again
  });
});
