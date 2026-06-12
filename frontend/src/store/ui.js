import { defineStore } from "pinia";

export const useUiStore = defineStore("ui", {
  state: () => ({
    theme: localStorage.getItem("theme") || "dark",
    asideShow: window.innerWidth > 1024,
    lang: localStorage.getItem("lang") || "en",
    asideWidth: parseInt(localStorage.getItem("asideWidth") || "220", 10),
    acctPanelWidth: parseInt(localStorage.getItem("acctPanelWidth") || "280", 10),
  }),
  getters: {
    isDark: (s) => s.theme === "dark",
  },
  actions: {
    /**
     * Apply the current theme to <html> and persist the choice.
     * Does NOT animate — call this directly on app boot or as the
     * inner mutation from `toggleTheme` (where the View Transition
     * pseudo-elements drive the visual switch).
     */
    applyTheme() {
      const el = document.documentElement;
      if (this.theme === "dark") el.classList.add("dark");
      else el.classList.remove("dark");
      localStorage.setItem("theme", this.theme);
    },

    /**
     * Toggle between dark/light with a radial clip-path reveal
     * centered on the click point — cloud-mail pattern.
     *
     * Falls back to an instant toggle when:
     *  - the View Transition API isn't available (Firefox/Safari),
     *  - no MouseEvent is provided (e.g. keyboard, programmatic call),
     *  - the user prefers reduced motion.
     */
    toggleTheme(event) {
      const next = this.theme === "dark" ? "light" : "dark";
      const root = document.documentElement;

      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const supported = typeof document.startViewTransition === "function";
      const hasPoint = event && typeof event.clientX === "number";

      if (!supported || !hasPoint || reduceMotion) {
        this.theme = next;
        this.applyTheme();
        return;
      }

      // Anchor the reveal at the click point and size it to cover the
      // farthest screen corner (so the wipe always finishes off-screen).
      const x = event.clientX;
      const y = event.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      root.style.setProperty("--vt-x", `${x}px`);
      root.style.setProperty("--vt-y", `${y}px`);
      root.style.setProperty("--vt-end-radius", `${endRadius + 10}px`);
      // The CSS uses [data-theme-to="dark|light"] to pick the right keyframe.
      root.setAttribute("data-theme-to", next);

      const transition = document.startViewTransition(() => {
        this.theme = next;
        this.applyTheme();
      });

      transition.finished.finally(() => {
        root.removeAttribute("data-theme-to");
      });
    },

    setTheme(t) {
      this.theme = t;
      this.applyTheme();
    },

    toggleAside() {
      this.asideShow = !this.asideShow;
    },

    setLang(code) {
      this.lang = code;
      localStorage.setItem("lang", code);
    },

    /**
     * Update the main aside width (drag-resize). Below the collapse
     * threshold the panel auto-hides instead of clamping to a tiny width.
     */
    setAsideWidth(w) {
      const COLLAPSE_AT = 100;
      if (w < COLLAPSE_AT) {
        this.asideShow = false;
        // Reset to a sensible default so the next toggle opens at a usable width.
        this.asideWidth = 220;
        localStorage.setItem("asideWidth", "220");
        return;
      }
      this.asideWidth = w;
      localStorage.setItem("asideWidth", String(w));
    },

    /**
     * Update the in-Inbox account panel width. Has no auto-collapse —
     * the account list always stays visible (per UX request).
     */
    setAcctPanelWidth(w) {
      const MIN = 200;
      const MAX = 520;
      const next = Math.min(MAX, Math.max(MIN, w));
      this.acctPanelWidth = next;
      localStorage.setItem("acctPanelWidth", String(next));
    },
  },
});
