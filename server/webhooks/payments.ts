import { Request, Response } from "express";
import { processWebhookEventIdempotently, getDb } from "../db";
import { platformInvoices, platformPayments, organizationSubscriptions, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as crypto from "crypto";

export async function handlePaymentWebhook(req: Request, res: Response) {
  try {
    const provider = req.headers["x-webhook-provider"] as string;
    const eventId = req.headers["x-webhook-event-id"] as string;

    if (!provider || !eventId) {
      res.status(400).json({ error: "Missing required headers x-webhook-provider or x-webhook-event-id" });
      return;
    }

    // 1. Webhook cryptographical verification (using RAW buffer, not JSON stringify)
    // We assume the raw body is available on req.body if configured with express.raw, but since it's JSON we must rely on a saved raw body buffer
    const signature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (provider !== "mock") {
      if (!signature || !timestamp || !webhookSecret) {
        res.status(401).json({ error: "Missing signature, timestamp, or webhook secret" });
        return;
      }

      // 2. Replay protection (tolerance: 5 minutes)
      const eventTime = parseInt(timestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - eventTime) > 300) {
        res.status(401).json({ error: "Timestamp out of bounds (replay protection)" });
        return;
      }

      // Look for the raw body attached by our middleware
      const rawBodyBuffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

      const dataToSign = Buffer.concat([
        Buffer.from(timestamp + "."),
        rawBodyBuffer
      ]);

      const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(dataToSign).digest("hex");

      if (signature !== expectedSignature) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }

    const payloadStr = JSON.stringify(req.body);

    const processed = await processWebhookEventIdempotently(
      provider,
      eventId,
      payloadStr,
      async (tx) => {
        console.log(`[Webhooks] Processing payment event ${eventId} from ${provider}`);

        const data = req.body;

        if (!data || !data.invoiceNumber || !data.status) {
          throw new Error("Invalid webhook payload format");
        }

        const invoice = await tx.select().from(platformInvoices).where(eq(platformInvoices.number, data.invoiceNumber)).for("update").limit(1);

        if (!invoice[0]) {
           throw new Error(`Invoice ${data.invoiceNumber} not found`);
        }

        // Validate amount strictly
        if (data.amount && parseFloat(data.amount) !== parseFloat(invoice[0].total)) {
           throw new Error(`Webhook amount ${data.amount} does not match invoice total ${invoice[0].total}`);
        }

        if (data.status === "paid") {
          await tx.update(platformInvoices).set({ status: "paid" }).where(eq(platformInvoices.id, invoice[0].id));
          await tx.insert(platformPayments).values({
            organizationId: invoice[0].organizationId,
            invoiceId: invoice[0].id,
            amount: invoice[0].total, // Enforce exact expected amount
            method: "gateway",
            status: "confirmed",
            reference: data.reference || eventId
          });
          await tx.update(organizationSubscriptions).set({ status: "active" }).where(and(eq(organizationSubscriptions.organizationId, invoice[0].organizationId), eq(organizationSubscriptions.status, "past_due")));
          await tx.update(organizations).set({ status: "active" }).where(eq(organizations.id, invoice[0].organizationId));
        } else if (data.status === "failed") {
          await tx.update(platformInvoices).set({ status: "overdue" }).where(eq(platformInvoices.id, invoice[0].id));
          await tx.update(organizationSubscriptions).set({ status: "past_due" }).where(and(eq(organizationSubscriptions.organizationId, invoice[0].organizationId), eq(organizationSubscriptions.status, "active")));
        }
      }
    );

    if (!processed) {
      console.log(`[Webhooks] Ignored duplicate event ${eventId} from ${provider}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("[Webhooks] Error processing webhook:", error);
    res.status(500).json({ error: error.message || "Internal webhook processing error" });
  }
}
