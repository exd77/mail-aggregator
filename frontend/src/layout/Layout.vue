<template>
  <el-container class="layout">
    <el-aside
      class="aside"
      :class="uiStore.asideShow ? 'aside-show' : 'aside-hide'"
      :style="uiStore.asideShow ? { width: uiStore.asideWidth + 'px' } : null"
    >
      <Aside />

      <!-- Drag handle on the right edge: drag to expand, drag past
           the collapse threshold to auto-hide the whole sidebar. -->
      <div
        v-if="uiStore.asideShow"
        class="resize-handle"
        @mousedown="onAsideResizeStart"
      ></div>
    </el-aside>

    <div
      :class="(uiStore.asideShow && isMobile) ? 'overlay-show' : 'overlay-hide'"
      @click="uiStore.asideShow = false"
    ></div>

    <el-container class="main-container">
      <el-header class="app-header">
        <Header />
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import Aside from "@/layout/aside/index.vue";
import Header from "@/layout/header/index.vue";
import { useUiStore } from "@/store/ui";
import { useResizable } from "@/composables/useResizable";
import { startMailNotifier, stopMailNotifier } from "@/composables/useMailNotifier";

const uiStore = useUiStore();
const { t } = useI18n();
const router = useRouter();
const isMobile = ref(window.innerWidth < 1025);

function handleResize() {
  isMobile.value = window.innerWidth < 1025;
  uiStore.asideShow = window.innerWidth > 1024;
}

const { startResize: onAsideResizeStart } = useResizable({
  getStartLeft: () => 0,            // aside is anchored to the viewport's left edge
  min: 0,                           // allow going to 0 so collapse threshold can fire
  max: 420,
  onUpdate: (w) => uiStore.setAsideWidth(w),
});

onMounted(() => {
  window.addEventListener("resize", handleResize);
  handleResize();
  // New-mail notifications + chime (Outlook-style). Only runs inside the
  // authenticated shell, so it stops automatically on logout (unmount).
  startMailNotifier({ t, router });
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  stopMailNotifier();
});
</script>

<style scoped>
.layout {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}
.aside {
  /* Width comes from inline :style; transition only on show/hide. */
  background: var(--aside-backgound);
  /* macOS sidebar vibrancy: translucent material + blur. Falls back
     to the solid --aside-backgound where backdrop-filter is absent. */
  background: var(--aside-material);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  overflow: hidden;
  position: relative;
  border-right: 1px solid var(--hairline);
}
.aside-hide {
  width: 0 !important;
  transition: width 0.15s ease;
}
.aside-show {
  /* No CSS transition — width follows the cursor smoothly during drag. */
}
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  user-select: none;
  background: transparent;
  transition: background 0.15s;
  z-index: 5;
}
.resize-handle:hover,
.resize-handle:active {
  background: var(--brand-color);
  opacity: 0.6;
}
.main-container {
  min-height: 100%;
  background: var(--content-bg);
  overflow: hidden;
}
.app-header {
  padding: 0;
  height: 52px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--hairline);
  /* translucent toolbar with blur — macOS unified titlebar */
  background: var(--aside-material);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
}
.app-main {
  padding: 0;
  height: calc(100vh - 52px);
  overflow: hidden;
  background: var(--content-bg);
}

@media (max-width: 1024px) {
  .aside-show {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 101;
    height: 100%;
  }
}
.overlay-show {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  transition: all 0.3s;
}
.overlay-hide { display: none; }
</style>
