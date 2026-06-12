<template>
  <Teleport to="body">
    <Transition name="mc-fade">
      <div v-if="confirmState.open" class="mc-backdrop" @click.self="onCancel">
        <Transition name="mc-pop" appear>
          <div v-if="confirmState.open" class="mc-window" role="dialog" :aria-label="confirmState.title">
            <!-- macOS title bar with traffic-light dots -->
            <div class="mc-title-bar">
              <div class="mc-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
              </div>
              <div class="mc-title">{{ confirmState.title }}</div>
            </div>

            <!-- Body -->
            <div class="mc-body">
              <p class="mc-message">{{ confirmState.message }}</p>
            </div>

            <!-- Footer with right-aligned buttons -->
            <div class="mc-footer">
              <button class="mc-btn mc-btn--cancel" @click="onCancel" ref="cancelRef">
                {{ confirmState.cancelText }}
              </button>
              <button
                class="mc-btn"
                :class="confirmState.danger ? 'mc-btn--danger' : 'mc-btn--confirm'"
                @click="onConfirm"
              >
                {{ confirmState.confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";
import { confirmState, _resolveConfirm } from "@/composables/useConfirm";

const cancelRef = ref(null);

function onCancel() { _resolveConfirm(false); }
function onConfirm() { _resolveConfirm(true); }

function onKey(e) {
  if (!confirmState.open) return;
  if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  if (e.key === "Enter") { e.preventDefault(); onConfirm(); }
}

watch(() => confirmState.open, (open) => {
  if (open) {
    window.addEventListener("keydown", onKey);
    // Focus the cancel button so Esc/Enter both work and accidental Enter
    // doesn't auto-trigger destructive actions.
    nextTick(() => cancelRef.value?.focus());
  } else {
    window.removeEventListener("keydown", onKey);
  }
});
</script>

<style scoped>
/* ---- backdrop ---- */
.mc-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* ---- window ---- */
.mc-window {
  width: 100%;
  max-width: 400px;
  background: var(--aside-backgound, #1c1c1e);
  border: 1px solid var(--hairline-strong, rgba(255,255,255,0.14));
  border-radius: var(--radius-lg, 12px);
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.5),
    0 10px 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  /* macOS windows are slightly translucent; respect the fill in light mode */
  color: var(--el-text-color-primary);
}

/* ---- title bar with traffic lights ---- */
.mc-title-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--hairline);
}
.mc-dots {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 6px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}
.dot.red    { background: var(--tl-red, #ff5f57); }
.dot.yellow { background: var(--tl-yellow, #febc2e); }
.dot.green  { background: var(--tl-green, #28c840); }
.mc-title {
  font-size: var(--text-base, 14px);
  font-weight: 700;
  color: var(--el-text-color-primary);
}

/* ---- body ---- */
.mc-body {
  padding: 22px 22px 18px;
}
.mc-message {
  margin: 0;
  font-size: var(--text-base, 14px);
  line-height: 1.5;
  color: var(--el-text-color-primary);
  word-wrap: break-word;
}

/* ---- footer / buttons ---- */
.mc-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 22px 20px;
}
.mc-btn {
  border: none;
  outline: none;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--text-sm, 13px);
  font-weight: 510;
  padding: 8px 18px;
  border-radius: var(--radius-sm, 8px);
  transition: filter 0.15s, background 0.15s;
}
.mc-btn:focus-visible {
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.4);
}
.mc-btn--cancel {
  background: transparent;
  color: var(--el-text-color-regular);
}
.mc-btn--cancel:hover { background: var(--row-hover); }

.mc-btn--confirm {
  background: var(--brand-color);
  color: #fff;
}
.mc-btn--confirm:hover { filter: brightness(1.1); }

.mc-btn--danger {
  background: var(--sf-red, #ff3b30);
  color: #fff;
}
.mc-btn--danger:hover { filter: brightness(1.1); }

/* ---- transitions ---- */
.mc-fade-enter-active,
.mc-fade-leave-active { transition: opacity 0.18s ease; }
.mc-fade-enter-from,
.mc-fade-leave-to { opacity: 0; }

.mc-pop-enter-active { transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease; }
.mc-pop-enter-from   { transform: scale(0.92); opacity: 0; }
.mc-pop-leave-active { transition: transform 0.15s ease, opacity 0.15s ease; }
.mc-pop-leave-to     { transform: scale(0.95); opacity: 0; }
</style>
