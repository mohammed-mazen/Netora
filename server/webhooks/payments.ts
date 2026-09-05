import { Request, Response } from "express";
import { processWebhookEventIdempotently } from "../db";

export async function handlePaymentWebhook(req: Request, res: Response) {
  try {
    const provider = req.headers["x-webhook-provider"] as string || "unknown";
    const eventId = req.headers["x-webhook-event-id"] as string || `evt_${Date.now()}_${Math.random()}`;
    const payloadStr = JSON.stringify(req.body);

    const processed = await processWebhookEventIdempotently(
      provider,
      eventId,
      payloadStr,
      async () => {
        // Mocking the actual business logic for now since we don't have a specific
        // payment provider SDK installed (e.g. Stripe). In a real implementation,
        // this would parse the event payload, find the corresponding invoice or
        // subscription, and update its state via db transactions.
        console.log(`[Webhooks] Processing payment event ${eventId} from ${provider}`);
      }
    );

    if (!processed) {
      console.log(`[Webhooks] Ignored duplicate event ${eventId} from ${provider}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Webhooks] Error processing webhook:", error);
    res.status(500).json({ error: "Internal webhook processing error" });
  }
}
