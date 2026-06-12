import { ElNotification } from "element-plus";
import { apiInbox } from "@/api";
import { extractName } from "@/utils/format";
import { playNewMailChime } from "@/utils/sound";

/**
 * Outlook-style new-mail notifier.
 *
 * Periodically (default 60s) tells the backend to sync every connected
 * account, then loads the unified inbox and diffs it against the IDs
 * we've already shown. Any genuinely new message pops an Element Plus
 * notification (sender + subject + snippet) and rings a chime.
 *
 * On the FIRST tick we just seed the "seen" set without notifying —
 * otherwise opening the dashboard would immediately spam a popup for
 * every cached email.
 *
 * After each successful tick we dispatch a `mail:new` window event so
 * the Inbox view can refresh its visible list without re-implementing
 * the polling itself.
 */
const POLL_INTERVAL_MS = 15_000;
const RECENT_LIMIT = 30; // how many recent messages to scan per tick
const NOTIF_BATCH_CAP = 5; // never spam more than this many popups at once

let timer = null;
let seenIds = null; // Set<number> — null means "not seeded yet"
let i18nT = null;
let routerRef = null;

async function tick() {
  // The backend runs its own auto-sync loop, so here we only need a
  // lightweight read of the unified inbox — fast, and safe to run often.
  let messages;
  try {
    messages = await apiInbox({ limit: RECENT_LIMIT });
  } catch {
    return;
  }
  if (!Array.isArray(messages)) return;

  // First tick: seed and bail.
  if (seenIds === null) {
    seenIds = new Set(messages.map((m) => m.id));
    return;
  }

  // Diff. Newest-first ordering means the first .filter() result
  // is already the most recent. Cap to avoid notification floods.
  const fresh = messages.filter((m) => !seenIds.has(m.id)).slice(0, NOTIF_BATCH_CAP);
  if (!fresh.length) return;

  for (const m of fresh) seenIds.add(m.id);

  // Notify + chime. One sound for the whole batch — multiple beeps
  // at once is annoying.
  playNewMailChime();
  for (const m of fresh) {
    showMailNotification(m);
  }

  // Tell the rest of the app fresh data exists.
  window.dispatchEvent(new CustomEvent("mail:new", { detail: { count: fresh.length, ids: fresh.map((m) => m.id) } }));
}

function showMailNotification(m) {
  const sender = extractName(m.from_addr) || (m.from_addr || "");
  const account = m.account_email || "";
  const subject = m.subject || (i18nT ? i18nT("reader.noSubject") : "(no subject)");
  const appLabel = i18nT ? i18nT("brand") : "Mail";

  // First letter of the sender drives the avatar monogram — Apple Mail
  // shows a circular contact glyph next to each notification.
  const initial = (sender || "?").trim().charAt(0).toUpperCase() || "?";

  const notif = ElNotification({
    customClass: "mac-mail-notif",
    dangerouslyUseHTMLString: true,
    // We render the entire card ourselves (title left blank) so the
    // layout matches macOS Notification Center: icon · text stack.
    message: `
      <div class="mn-card">
        <div class="mn-avatar">${escapeHtml(initial)}</div>
        <div class="mn-body">
          <div class="mn-row">
            <span class="mn-app">${escapeHtml(appLabel)}</span>
            <span class="mn-time">now</span>
          </div>
          <div class="mn-sender">${escapeHtml(sender)}</div>
          <div class="mn-subject">${escapeHtml(subject)}</div>
          <div class="mn-snippet">${escapeHtml(m.snippet || "")}</div>
          ${account ? `<div class="mn-account">${escapeHtml(account)}</div>` : ""}
        </div>
      </div>
    `,
    duration: 6500,
    position: "top-right",
    offset: 12,
    onClick: () => {
      // Take the user to the inbox; selecting the specific message would
      // require deep-linking, which we don't have yet.
      if (routerRef && routerRef.currentRoute.value.path !== "/inbox") {
        routerRef.push("/inbox");
      }
      notif.close();
    },
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Start the notifier. Idempotent.
 * @param {{ t: Function, router: import("vue-router").Router }} opts
 */
export function startMailNotifier(opts = {}) {
  i18nT = opts.t || null;
  routerRef = opts.router || null;
  if (timer) return;
  // Run one tick immediately to seed, then kick off the interval.
  tick();
  timer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopMailNotifier() {
  if (timer) clearInterval(timer);
  timer = null;
  seenIds = null; // re-seed on next start (e.g. after re-login)
}
