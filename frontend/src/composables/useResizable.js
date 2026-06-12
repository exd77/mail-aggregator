/**
 * Drag-to-resize composable. Returns a `startResize(event)` handler to attach
 * to a vertical drag handle. While dragging, it computes the new width based
 * on the cursor's X position relative to `getStartLeft()`, clamps to
 * [min, max], and calls `onUpdate(width)`. When the drag ends, `onEnd(width)`
 * is fired so the caller can persist or trigger collapse logic.
 *
 * Pure DOM events — no scoping to a particular framework, but this file is
 * meant to be consumed from Vue components.
 */
export function useResizable({ getStartLeft, min = 0, max = 480, onUpdate, onEnd }) {
  function startResize(event) {
    event.preventDefault();
    const startLeft = getStartLeft();

    function onMove(e) {
      const x = e.clientX;
      const raw = x - startLeft;
      const w = Math.min(max, Math.max(min, raw));
      onUpdate?.(w);
    }
    function onUp(e) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const x = e.clientX;
      const raw = x - startLeft;
      const w = Math.min(max, Math.max(min, raw));
      onEnd?.(w);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { startResize };
}
