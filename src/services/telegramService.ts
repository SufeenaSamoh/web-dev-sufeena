import type { PurchaseOrder } from "@/features/purchase/types";
import { formatDate } from "@/lib/dateFormat";

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}

const STORAGE_KEY = "hana_telegram_config_v2";
const LEGACY_STORAGE_KEY = "hana_telegram_config_v1";
const LEGACY_OLD_CHAT_ID = "-5273511075"; // Deprecated deleted group

export const DEFAULT_BOT_TOKEN = "8752237118:AAESmZ6LGiFuo02UwClpoc0vHQw0J4FMBp8";
export const DEFAULT_CHAT_ID = "-5339946631"; // Active "NongPhak" Group

/** Escape HTML entities for Telegram HTML parse_mode */
function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Get current Telegram Bot configuration.
 * Checks localStorage first, with auto-migration from legacy/deleted chat IDs,
 * then environment variables, then the default active NongPhak group.
 */
export function getTelegramConfig(): TelegramConfig {
  try {
    // Clear legacy storage if present
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let targetChatId = parsed.chatId || import.meta.env.VITE_TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID;

      // HARD SANITIZATION: If stored chat ID is the old deleted group (-5273511075),
      // immediately force overwrite to the new active group (-5339946631)
      if (targetChatId === LEGACY_OLD_CHAT_ID || !targetChatId) {
        console.info(
          `[TelegramService] Overriding deleted legacy chat_id (${targetChatId}) with active NongPhak chat_id (${DEFAULT_CHAT_ID})`,
        );
        targetChatId = DEFAULT_CHAT_ID;
        saveTelegramConfig({
          botToken: parsed.botToken || import.meta.env.VITE_TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
          chatId: DEFAULT_CHAT_ID,
          isEnabled: parsed.isEnabled !== false,
        });
      }

      return {
        botToken: parsed.botToken || import.meta.env.VITE_TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
        chatId: targetChatId,
        isEnabled: parsed.isEnabled !== false,
      };
    }
  } catch (e) {
    console.warn("[TelegramService] Failed to read telegram config from localStorage", e);
  }

  const envChatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
  const activeChatId = envChatId && envChatId !== LEGACY_OLD_CHAT_ID ? envChatId : DEFAULT_CHAT_ID;

  return {
    botToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
    chatId: activeChatId,
    isEnabled: true,
  };
}

/**
 * Save Telegram configuration to localStorage
 */
export function saveTelegramConfig(config: TelegramConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save telegram config to localStorage", e);
  }
}

/**
 * Sends a text message to Telegram using direct Telegram Bot API
 */
export async function sendTelegramMessage(
  htmlText: string,
  configOverride?: Partial<TelegramConfig>,
): Promise<{ success: boolean; error?: string }> {
  const config = { ...getTelegramConfig(), ...configOverride };

  if (!config.isEnabled) {
    return { success: false, error: "Telegram notification is disabled in settings" };
  }

  const token = config.botToken || DEFAULT_BOT_TOKEN;
  const chatId = config.chatId || DEFAULT_CHAT_ID;

  if (!token || !chatId) {
    return {
      success: false,
      error: "Telegram Bot Token or Chat ID is not configured",
    };
  }

  console.info(
    `[TelegramService] Dispatching message to Chat ID: ${chatId} (Target Group: NongPhak) via Bot: ${token.substring(0, 10)}...`,
  );

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      console.info(
        `[TelegramService] ✅ Message successfully delivered to Chat ID: ${chatId}. Telegram Message ID: ${data.result?.message_id}`,
      );
      return { success: true };
    }

    console.error(`[TelegramService] ❌ Telegram API returned error for Chat ID: ${chatId}:`, data);
    return { success: false, error: data.description || "Telegram API error" };
  } catch (err) {
    console.error(`[TelegramService] ❌ Network error while sending to Chat ID ${chatId}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error while connecting to Telegram",
    };
  }
}

/**
 * Sends a Document (HTML/PDF/image file) to Telegram using direct Telegram Bot API (sendDocument)
 */
export async function sendTelegramDocument(params: {
  document: Blob;
  fileName: string;
  caption?: string;
  configOverride?: Partial<TelegramConfig>;
}): Promise<{ success: boolean; error?: string }> {
  const config = { ...getTelegramConfig(), ...params.configOverride };

  if (!config.isEnabled) {
    return { success: false, error: "Telegram notification is disabled in settings" };
  }

  const token = config.botToken || DEFAULT_BOT_TOKEN;
  const chatId = config.chatId || DEFAULT_CHAT_ID;

  if (!token || !chatId) {
    return {
      success: false,
      error: "Telegram Bot Token or Chat ID is not configured",
    };
  }

  console.info(
    `[TelegramService] Uploading document (${params.fileName}) to Chat ID: ${chatId} via Bot...`,
  );

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", params.document, params.fileName);
    if (params.caption) {
      formData.append("caption", params.caption);
      formData.append("parse_mode", "HTML");
    }

    const url = `https://api.telegram.org/bot${token}/sendDocument`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.ok) {
      console.info(
        `[TelegramService] ✅ Document (${params.fileName}) successfully delivered to Chat ID: ${chatId}. Message ID: ${data.result?.message_id}`,
      );
      return { success: true };
    }

    console.error(`[TelegramService] ❌ Telegram sendDocument returned error:`, data);
    return { success: false, error: data.description || "Telegram sendDocument API error" };
  } catch (err) {
    console.error(`[TelegramService] ❌ Network error while uploading document:`, err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Network error while uploading document to Telegram",
    };
  }
}

/**
 * Generates an isolated HTML document string for a Purchase Order (ใบสั่งซื้อ).
 * Uses strictly explicit hex colors (#ffffff, #0f172a, etc.) and Thai font Sarabun.
 */
export function generatePoDocumentHtml(order: PurchaseOrder, branchName?: string): string {
  const bName = branchName || order.branchName || "สาขาหลัก";
  const orderDateFormatted = formatDate(order.orderDate);
  const expectedDateFormatted = order.expectedReceivedDate
    ? formatDate(order.expectedReceivedDate)
    : orderDateFormatted;
  const items = order.items || [];
  const totalAmount = order.totalAmount || items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);

  const statusText =
    order.status === "received"
      ? "ได้รับสินค้าเข้าคลังแล้ว"
      : order.status === "approved"
        ? "จัดซื้ออนุมัติแล้ว"
        : order.status === "in_transit"
          ? "สินค้าอยู่ระหว่างขนส่ง"
          : "รอดำเนินการจัดซื้อ";

  const itemRows = items
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? "background-color: #f8fafc;" : "background-color: #ffffff;"}">
        <td style="padding: 9px 12px; text-align: center; color: #64748b; font-size: 13px;">${idx + 1}</td>
        <td style="padding: 9px 12px; font-family: monospace; font-size: 13px; font-weight: 600; color: #0f172a;">${escapeHtml(item.productCode || "-")}</td>
        <td style="padding: 9px 12px; font-size: 13px; font-weight: 600; color: #0f172a;">${escapeHtml(item.productName)}</td>
        <td style="padding: 9px 12px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">${item.quantity.toLocaleString()} ${escapeHtml(item.unit || "หน่วย")}</td>
        <td style="padding: 9px 12px; text-align: right; font-size: 13px; color: #334155;">฿${(item.unitPrice || 0).toLocaleString()}</td>
        <td style="padding: 9px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #059669;">฿${(item.totalPrice || 0).toLocaleString()}</td>
      </tr>`,
    )
    .join("\n");

  return `<div class="po-card" style="max-width: 760px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #cbd5e1; box-sizing: border-box; font-family: 'Sarabun', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.5; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
      <div>
        <div style="background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">ใบสั่งซื้อวัตถุดิบ (PURCHASE ORDER)</div>
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">${escapeHtml(bName)}</h1>
        <p style="font-size: 12px; color: #64748b; margin-top: 4px; margin-bottom: 0;">เลขที่เอกสาร: <strong style="font-family: monospace; color: #0f172a;">${escapeHtml(order.id)}</strong></p>
      </div>
      <div style="text-align: right; font-size: 12px; color: #334155; line-height: 1.5;">
        <p style="margin: 0;"><strong>วันที่สั่งซื้อ:</strong> ${orderDateFormatted}</p>
        <p style="margin: 3px 0 0 0;"><strong>กำหนดรับเข้า:</strong> ${expectedDateFormatted}</p>
        <p style="margin: 3px 0 0 0;"><strong>ผู้ทำรายการ:</strong> ${escapeHtml(order.createdBy || "ผู้จัดการสาขา")}</p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 20px; font-size: 12px;">
      <div>
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">ข้อมูลซัพพลายเออร์ (Supplier)</div>
        <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${escapeHtml(order.supplierName)}</div>
        <div style="color: #64748b; margin-top: 3px;"><strong>เงื่อนไขจัดส่ง:</strong> ${escapeHtml(order.deliveryTerms || "จัดส่งถึงสาขา")}</div>
      </div>
      <div>
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">สถานะใบสั่งซื้อ (Status)</div>
        <div style="font-weight: 700; color: #059669; font-size: 14px;">${statusText}</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="padding: 9px 10px; text-align: center; width: 40px; font-weight: 700; color: #ffffff;">#</th>
          <th style="padding: 9px 10px; text-align: left; width: 110px; font-weight: 700; color: #ffffff;">รหัสสินค้า</th>
          <th style="padding: 9px 10px; text-align: left; font-weight: 700; color: #ffffff;">รายการวัตถุดิบ</th>
          <th style="padding: 9px 10px; text-align: right; width: 100px; font-weight: 700; color: #ffffff;">จำนวน</th>
          <th style="padding: 9px 10px; text-align: right; width: 100px; font-weight: 700; color: #ffffff;">ราคา/หน่วย</th>
          <th style="padding: 9px 10px; text-align: right; width: 110px; font-weight: 700; color: #ffffff;">รวมเงิน</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
      <div style="background-color: #f0fdf4; border: 2px solid #059669; border-radius: 10px; padding: 12px 20px; text-align: right; min-width: 280px;">
        <div style="font-size: 11px; font-weight: 700; color: #166534;">ยอดรวมสุทธิทั้งสิ้น (Net Total)</div>
        <div style="font-size: 22px; font-weight: 800; color: #15803d; margin-top: 2px;">฿${totalAmount.toLocaleString()}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; padding-top: 18px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 12px;">
      <div>
        <div style="margin: 35px auto 6px auto; border-bottom: 1px solid #94a3b8; width: 75%;"></div>
        <div style="color: #0f172a; font-weight: 600;">( ${escapeHtml(order.createdBy || "ผู้สั่งซื้อ")} )</div>
        <div style="color: #64748b; font-size: 11px; margin-top: 2px;">ผู้จัดทำรายการ / ผู้สั่งซื้อ</div>
      </div>
      <div>
        <div style="margin: 35px auto 6px auto; border-bottom: 1px solid #94a3b8; width: 75%;"></div>
        <div style="color: #0f172a; font-weight: 600;">( ${escapeHtml(order.supplierName)} )</div>
        <div style="color: #64748b; font-size: 11px; margin-top: 2px;">ผู้รับใบสั่งซื้อ / ซัพพลายเออร์</div>
      </div>
    </div>
  </div>`;
}

/**
 * Creates a standalone clean HTML template wrapped with full reset styles and Sarabun Thai font.
 */
export function buildIsolatedPoHtml(order: PurchaseOrder, branchName?: string): string {
  const content = generatePoDocumentHtml(order, branchName);
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบสั่งซื้อ ${escapeHtml(order.id)} - ${escapeHtml(order.supplierName || "ซัพพลายเออร์")}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap');
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #f1f5f9;
      color: #0f172a;
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px 12px;
      margin: 0;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .po-card {
        border: none !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

/**
 * Creates a Blob file object and standard filename for a Purchase Order HTML document.
 */
export function generatePoDocumentBlob(
  order: PurchaseOrder,
  branchName?: string,
): { blob: Blob; fileName: string } {
  const htmlContent = buildIsolatedPoHtml(order, branchName);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });

  const cleanSupName = (order.supplierName || "Supplier").replace(/[^\w\u0E00-\u0E7F-]/g, "_");
  const cleanDate = (order.orderDate || "").replace(/[/\s:]/g, "-");
  const fileName = `PO_${cleanSupName}_${cleanDate}_${order.id}.html`;

  return { blob, fileName };
}

/**
 * Formats and builds concise HTML message for Urgent Orders (แจ้งเตือนการสั่งผักด่วน)
 * Exact format:
 * แจ้งเตือนการสั่งผักด่วน
 * สาขา: [ชื่อสาขา]
 * รอบวันที่สั่ง: [วันที่]
 * ชื่อผู้สั่ง: [ชื่อผู้สั่ง]
 */
export function buildTelegramUrgentOrderMessage(params: {
  branchName: string;
  orderDate: string;
  createdBy: string;
  orders?: PurchaseOrder[];
}): string {
  const { branchName, orderDate, createdBy } = params;

  return [
    `<b>แจ้งเตือนการสั่งผักด่วน</b>`,
    `<b>สาขา:</b> ${escapeHtml(branchName)}`,
    `<b>รอบวันที่สั่ง:</b> ${escapeHtml(formatDate(orderDate))}`,
    `<b>ชื่อผู้สั่ง:</b> ${escapeHtml(createdBy)}`,
  ].join("\n");
}

/**
 * High-level trigger to notify Telegram for urgent orders.
 *
 * Flow:
 * 1. Sends the concise alert text message first into the chat
 * 2. Immediately follows with the formatted HTML PO file(s) via `sendDocument`
 *    - 1 supplier = 1 HTML file
 *    - 2+ suppliers = 2+ HTML files sent sequentially in the same chat
 */
export async function notifyTelegramForUrgentOrders(params: {
  branchName: string;
  orderDate: string;
  createdBy: string;
  orders: PurchaseOrder[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { branchName, orderDate, createdBy, orders } = params;
    const messageText = buildTelegramUrgentOrderMessage({ branchName, orderDate, createdBy });

    console.info(
      `[TelegramService] Starting urgent order notification for ${orders?.length || 0} POs (Branch: ${branchName})...`,
    );

    // 1. Send the primary alert text message first
    const msgResult = await sendTelegramMessage(messageText);
    if (!msgResult.success) {
      console.warn("[TelegramService] Failed to send initial text message:", msgResult.error);
      return msgResult;
    }

    // 2. If no orders attached, complete here
    if (!orders || orders.length === 0) {
      return { success: true };
    }

    // 3. Sequentially send HTML document file with detailed caption for each PO in the same chat
    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      try {
        const { blob, fileName } = generatePoDocumentBlob(ord, branchName);
        const total =
          ord.totalAmount || (ord.items || []).reduce((sum, it) => sum + (it.totalPrice || 0), 0);
        const caption = [
          `<b>ใบสั่งซื้อ (${i + 1}/${orders.length}):</b> ${escapeHtml(ord.supplierName || "ซัพพลายเออร์")}`,
          `<b>เลขที่:</b> ${escapeHtml(ord.id)} | <b>ยอด:</b> ฿${total.toLocaleString()}`,
        ].join("\n");

        console.info(
          `[TelegramService] Uploading PO document ${i + 1}/${orders.length} (${fileName}) with caption...`,
        );
        const docResult = await sendTelegramDocument({
          document: blob,
          fileName,
          caption,
        });

        if (!docResult.success) {
          console.warn(
            `[TelegramService] Failed to upload PO document for ${ord.id}:`,
            docResult.error,
          );
        }
      } catch (docErr) {
        console.error(
          `[TelegramService] ❌ Error generating/sending HTML document for PO ${ord.id}:`,
          docErr,
        );
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[TelegramService] Failed to notify Telegram for urgent orders:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Test Telegram bot connection and send a ping to the group
 */
export async function testTelegramBotConnection(
  customConfig?: Partial<TelegramConfig>,
): Promise<{ success: boolean; message: string }> {
  const config = { ...getTelegramConfig(), ...customConfig };
  const token = config.botToken || DEFAULT_BOT_TOKEN;
  const chatId = config.chatId || DEFAULT_CHAT_ID;

  console.info(
    `[TelegramService] Testing connection to Chat ID: ${chatId} via Bot: ${token.substring(0, 10)}...`,
  );

  try {
    // 1. Test getMe to verify token
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      return {
        success: false,
        message: `Token ไม่ถูกต้อง: ${meData.description || "Invalid Bot Token"}`,
      };
    }

    const botName = meData.result?.first_name || meData.result?.username || "NongPhakBot";

    // 2. Test sending a test ping to the chat
    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🟢 <b>[ทดสอบระบบ] บอท ${escapeHtml(botName)} เชื่อมต่อสำเร็จ</b>\n⏰ เวลาทดสอบ: ${new Date().toLocaleTimeString("th-TH")}\n📍 กลุ่มปลายทาง: NongPhak (ID: <code>${chatId}</code>)\n⚡ ระบบพร้อมส่งแจ้งเตือนการสั่งผักด่วนเข้ากลุ่มแล้วครับ`,
        parse_mode: "HTML",
      }),
    });

    const sendData = await sendRes.json();
    if (!sendData.ok) {
      console.warn(`[TelegramService] Test ping failed for Chat ID ${chatId}:`, sendData);
      return {
        success: false,
        message: `บอท @${meData.result?.username} ใช้งานได้ แต่ไม่สามารถส่งเข้า Chat ID (${chatId}) ได้: ${sendData.description}. กรุณาตรวจสอบว่าดึงบอทเข้ากลุ่มแล้วหรือยัง`,
      };
    }

    console.info(`[TelegramService] Test ping succeeded for Chat ID ${chatId}`);
    return {
      success: true,
      message: `ส่งข้อความทดสอบสำเร็จ! บอท: ${botName} (@${meData.result?.username}) -> กลุ่ม NongPhak (Chat ID: ${chatId})`,
    };
  } catch (err) {
    console.error(`[TelegramService] Test exception for Chat ID ${chatId}:`, err);
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err instanceof Error ? err.message : "Network error"}`,
    };
  }
}
