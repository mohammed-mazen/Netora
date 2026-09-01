// Outbound notification dispatch for cross-cutting alerts (currently just
// the server-monitor Telegram battery alert). The Telegram bot itself is a
// single process-wide bot (token in TELEGRAM_BOT_TOKEN env var) shared
// across all tenants — only the destination chat id differs per
// organization (stored in monitorSettings.telegramChatId). If the bot
// token or the organization's chat id isn't configured, this is a no-op:
// callers (see recordTenantMonitorSample in server/db.ts) already wrap the
// call in try/catch so a missing configuration never blocks the request
// that triggered the alert.
export async function sendTelegramBatteryAlert(input: { chatId: string | null; batteryPercent: number }): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !input.chatId) {
    console.warn("[Notifications] Telegram battery alert skipped — bot token or chat id not configured");
    return;
  }
  const text = `⚠️ تنبيه بطارية منخفضة: مستوى البطارية الحالي ${input.batteryPercent}%.`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: input.chatId, text }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`فشل إرسال تنبيه تيليجرام (${response.status}): ${body}`);
  }
}
