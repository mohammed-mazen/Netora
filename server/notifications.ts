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

export async function sendTelegramAlert(input: { chatId: string | null; text: string }): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !input.chatId) {
    console.warn("[Notifications] Telegram alert skipped — bot token or chat id not configured");
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: input.chatId, text: input.text }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`فشل إرسال تنبيه تيليجرام (${response.status}): ${body}`);
  }
}
