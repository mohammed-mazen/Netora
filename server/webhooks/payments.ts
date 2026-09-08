import { Request, Response } from "express";
import { processWebhookEventIdempotently, getDb } from "../db";
import { platformInvoices, platformPayments, organizationSubscriptions, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function handlePaymentWebhook(req: Request, res: Response) {
  try {
    const provider = req.headers["x-webhook-provider"] as string;
    const eventId = req.headers["x-webhook-event-id"] as string;
    const signature = req.headers["x-webhook-signature"] as string;
    const timestampStr = req.headers["x-webhook-timestamp"] as string;

    // 1. Authenticate Sender & Payload (Cryptographic Verification)
    if (!provider || !eventId || !signature || !timestampStr) {
      res.status(401).json({ error: "Missing required webhook headers" });
      return;
    }

    const timestamp = parseInt(timestampStr, 10);
    const now = Math.floor(Date.now() / 1000);
    // Reject if older than 5 minutes or in the future
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
      res.status(401).json({ error: "Invalid or expired webhook timestamp" });
      return;
    }

    // Express .raw() middleware ensures req.body is a Buffer
    if (!Buffer.isBuffer(req.body)) {
      res.status(500).json({ error: "Webhook endpoint must use express.raw() middleware" });
      return;
    }
    const payloadBuffer = req.body;
    const payloadStr = payloadBuffer.toString("utf8");

    // Ensure we have a webhook secret configured (could be env or DB)
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "default_dev_secret_do_not_use_in_prod";

    const signedPayload = `${timestampStr}.${payloadStr}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");

    if (expectedSignature.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    // 2. Process Event Idempotently in a Single DB Transaction
    const processed = await processWebhookEventIdempotently(
      provider,
      eventId,
      payloadStr,
      async (tx) => {
        console.log(`[Webhooks] Processing verified payment event ${eventId} from ${provider}`);

        const data = JSON.parse(payloadStr);
        if (!data || !data.invoiceNumber || !data.status || data.amount === undefined || data.currency === undefined) {
          throw new Error("Invalid webhook payload format");
        }

        // 3. Find invoice server-side (locking it for update if DB supports it, or just selecting)
        // Note: For true concurrency protection, we'd use 'FOR UPDATE', but Drizzle MySQL doesn't natively support it easily in this syntax without raw queries, so we rely on the transaction.
        const invoiceRows = await tx.select().from(platformInvoices).where(eq(platformInvoices.number, data.invoiceNumber)).limit(1);

        if (!invoiceRows || invoiceRows.length === 0) {
           throw new Error(`Invoice ${data.invoiceNumber} not found`);
        }

        const invoice = invoiceRows[0];

        // 4. Verify Amount and Currency
        if (invoice.currency !== data.currency) {
           throw new Error(`Currency mismatch: expected ${invoice.currency}, got ${data.currency}`);
        }

        // Ensure precise money comparison (assuming numeric strings or similar)
        if (Number(invoice.total) !== Number(data.amount)) {
           throw new Error(`Amount mismatch: expected ${invoice.total}, got ${data.amount}`);
        }

        // 5. Legal State Transitions
        if (invoice.status === "paid") {
           // Already paid, ignore safely
           console.log(`Invoice ${invoice.number} is already paid.`);
           return;
        }

        if (data.status === "paid") {
          await tx.update(platformInvoices).set({ status: "paid" }).where(eq(platformInvoices.id, invoice.id));
          await tx.insert(platformPayments).values({
            organizationId: invoice.organizationId,
            invoiceId: invoice.id,
            amount: data.amount,
            method: "gateway",
            status: "confirmed",
            reference: data.reference || eventId
          });
          await tx.update(organizationSubscriptions).set({ status: "active" }).where(and(eq(organizationSubscriptions.organizationId, invoice.organizationId), eq(organizationSubscriptions.status, "past_due")));
          await tx.update(organizations).set({ status: "active" }).where(eq(organizations.id, invoice.organizationId));
        } else if (data.status === "failed") {
          await tx.update(platformInvoices).set({ status: "overdue" }).where(eq(platformInvoices.id, invoice.id));
          await tx.update(organizationSubscriptions).set({ status: "past_due" }).where(and(eq(organizationSubscriptions.organizationId, invoice.organizationId), eq(organizationSubscriptions.status, "active")));
        }
      }
    );

    if (!processed) {
      console.log(`[Webhooks] Ignored duplicate event ${eventId} from ${provider}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("[Webhooks] Error processing webhook:", error);
    if (error.message.includes("mismatch") || error.message.includes("not found")) {
        res.status(409).json({ error: error.message });
    } else {
        res.status(500).json({ error: "Internal webhook processing error" });
    }
  }
}
