import { Request, Response } from "express";
import { processWebhookEventIdempotently, getDb } from "../db";
import { platformInvoices, platformPayments, organizationSubscriptions, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
        console.log(`[Webhooks] Processing payment event ${eventId} from ${provider}`);

        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Parse generic payment payload
        // Example: { "invoiceNumber": "INV-123", "status": "paid", "amount": "99.00", "reference": "tx_456" }
        const data = req.body;

        if (!data || !data.invoiceNumber || !data.status) {
          throw new Error("Invalid webhook payload format");
        }

        const invoice = await db.select().from(platformInvoices).where(eq(platformInvoices.number, data.invoiceNumber)).limit(1);

        if (!invoice[0]) {
           throw new Error(`Invoice ${data.invoiceNumber} not found`);
        }

        await db.transaction(async tx => {
          if (data.status === "paid") {
            await tx.update(platformInvoices).set({ status: "paid" }).where(eq(platformInvoices.id, invoice[0].id));
            await tx.insert(platformPayments).values({
              organizationId: invoice[0].organizationId,
              invoiceId: invoice[0].id,
              amount: data.amount || invoice[0].total,
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
        });
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
