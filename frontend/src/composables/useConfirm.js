import { reactive } from "vue";

/**
 * macOS-style confirmation dialog — programmatic API.
 *
 * Usage from any component:
 *   import { confirm } from "@/composables/useConfirm";
 *   const ok = await confirm({
 *     title: "Delete folder",
 *     message: 'Delete this folder?',
 *     confirmText: "Delete",
 *     cancelText: "Cancel",
 *     danger: true,
 *   });
 *   if (ok) await doDelete();
 *
 * The single MacConfirm component (mounted once in App.vue) reads this
 * state and renders the dialog. Each call gets its own Promise.
 */
export const confirmState = reactive({
  open: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  danger: false,
  _resolve: null,
});

export function confirm(opts = {}) {
  return new Promise((resolve) => {
    confirmState.title = opts.title ?? "Confirm";
    confirmState.message = opts.message ?? "";
    confirmState.confirmText = opts.confirmText ?? "Confirm";
    confirmState.cancelText = opts.cancelText ?? "Cancel";
    confirmState.danger = !!opts.danger;
    confirmState._resolve = resolve;
    confirmState.open = true;
  });
}

export function _resolveConfirm(answer) {
  if (typeof confirmState._resolve === "function") {
    confirmState._resolve(answer);
  }
  confirmState.open = false;
  confirmState._resolve = null;
}
