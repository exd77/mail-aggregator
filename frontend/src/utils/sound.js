/**
 * Short, pleasant two-tone chime for new-mail notifications.
 * Generated with the Web Audio API so we don't need to bundle a binary asset.
 *
 * Usage:
 *   import { playNewMailChime } from "@/utils/sound";
 *   playNewMailChime();
 *
 * Browsers gate audio behind a user gesture; if no gesture has happened
 * yet (e.g. the page just loaded and the user hasn't clicked anything),
 * the call is a no-op rather than throwing.
 */
let audioCtx = null;

function getCtx() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

function playTone(ctx, freq, when, duration, gainStart = 0.18) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;

  // Tiny attack + exponential release for a soft chime feel.
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(gainStart, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

export function playNewMailChime() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    // Safari/Chromium auto-suspend the context until a gesture; resume
    // is a no-op if it's already running.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (ctx.state !== "running") return;

    const t = ctx.currentTime;
    playTone(ctx, 880, t,        0.18); // A5
    playTone(ctx, 1318.51, t + 0.12, 0.22); // E6 — bright "ding-dong"
  } catch {
    /* swallow — sound is a nice-to-have, never critical */
  }
}

/**
 * Many browsers won't let us play any sound until the user has interacted
 * with the page. Wire this once at app boot to "unlock" the AudioContext
 * on the first click/keypress so later programmatic chimes can play.
 */
export function unlockAudio() {
  const handler = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    window.removeEventListener("click", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("click", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
}
