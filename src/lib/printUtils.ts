import { toast } from "sonner";

/**
 * Universal print helper function:
 * 1. Tries to open a standalone popup window for printing.
 * 2. If popup is blocked (or in an iframe/restricted browser), automatically creates a hidden printing iframe and prints reliably.
 * 3. Falls back to window.print() if all else fails.
 */
export function printHtmlDocument(htmlContent: string, title: string = "เอกสารการพิมพ์"): boolean {
  try {
    // 1. Try to open popup window with blob
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);

    const printWin = window.open(blobUrl, "_blank");
    if (printWin) {
      printWin.focus();
      toast.success("เปิดหน้าต่างพิมพ์สำเร็จ กำลังเรียกคำสั่งพิมพ์...");
      return true;
    }

    // 2. If popup was blocked, fallback to hidden iframe print
    return printViaHiddenIframe(htmlContent);
  } catch (err) {
    console.warn("Direct popup print error, falling back to hidden iframe:", err);
    return printViaHiddenIframe(htmlContent);
  }
}

/**
 * Print via dynamic hidden iframe without leaving the current view or needing popups
 */
export function printViaHiddenIframe(htmlContent: string): boolean {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "100px";
    iframe.style.height = "100px";
    iframe.style.opacity = "0.01";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "none";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return true;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("Iframe print error:", err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 4000);
      }
    }, 400);

    return true;
  } catch (err) {
    console.error("Hidden iframe print failed, falling back to window.print:", err);
    window.print();
    return true;
  }
}

/**
 * Formats current date and time for Thai print document headers
 */
export function getThaiPrintTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const thaiYear = year > 2400 ? year : year + 543;
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${thaiYear} ${hours}:${mins} น.`;
}
