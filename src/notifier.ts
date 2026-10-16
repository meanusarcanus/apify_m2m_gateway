export interface SaleAlertParams {
  actorTitle: string;
  endpoint: string;
  amount: string;
  payer: string;
  targetQuery?: string;
  executionTimeMs?: number;
}

/**
 * Sends real-time notification to Telegram whenever a machine pays for an API call.
 * Uses environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
 */
export async function sendTelegramSaleAlert(params: SaleAlertParams): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return; // Telegram alerts disabled if env vars not provided
  }

  const shortPayer = params.payer.length > 14 
    ? `${params.payer.slice(0, 6)}...${params.payer.slice(-4)}` 
    : params.payer;

  const message = [
    `🤖 <b>New M2M Machine Purchase!</b>`,
    ``,
    `💰 <b>Earned:</b> <code>+${params.amount} USDC</code> (Base)`,
    `⚡ <b>Tool:</b> ${params.actorTitle}`,
    `📡 <b>Route:</b> <code>${params.endpoint}</code>`,
    `🤖 <b>Buyer Agent:</b> <code>${shortPayer}</code>`,
    params.targetQuery ? `🔍 <b>Target:</b> <code>${params.targetQuery.slice(0, 100).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>` : null,
    params.executionTimeMs ? `⏱️ <b>Execution:</b> ${params.executionTimeMs}ms` : null,
    `💳 <b>Wallet:</b> <code>0x41215D81180560447cbbdB47bb08D10008204D58</code>`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Telegram Alert] Failed to dispatch: ${err}`);
    }
  } catch (err: any) {
    console.warn(`[Telegram Alert] Error sending message: ${err?.message || err}`);
  }
}
