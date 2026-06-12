/**
 * Time formatting — PM/AM style with "Just now" for recent messages.
 * @param {number} ms unix milliseconds
 * @returns {string} e.g. "Just now", "3:45 PM", "Jan 5"
 */
export function relativeTime(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "Just now";
  const d = new Date(ms);
  const now = new Date();
  // Same day → show PM/AM time
  if (d.toDateString() === now.toDateString()) {
    return formatTimePMAM(d);
  }
  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  // Same year → show month + day
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  // Different year → show full date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Format a Date to 12-hour PM/AM string. e.g. "3:45 PM"
 * @param {Date} d
 */
export function formatTimePMAM(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Extract a display name from an email "From" header.
 * e.g.  '"Jane Doe" <jane@x.com>'  -> 'Jane Doe'
 */
export function extractName(addr) {
  if (!addr) return "";
  const m = addr.match(/^"?([^"<]+?)"?\s*<.+>$/);
  return (m ? m[1] : addr).trim();
}

/**
 * Copy text to clipboard with a fallback for non-secure contexts
 * (navigator.clipboard is only available over HTTPS / localhost).
 * Returns true on success.
 */
export async function copyToClipboard(text) {
  // Preferred: async Clipboard API (secure contexts only)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy path */
    }
  }
  // Fallback: hidden textarea + execCommand('copy')
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Minimal HTML sanitizer — strips <script> tags and inline event handlers.
 * Basic XSS guard for rendering email bodies.
 */
export function sanitizeHtml(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
}

