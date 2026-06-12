<template>
  <el-scrollbar class="aside-scroll">
    <div class="aside-inner">
      <!-- Brand button -->
      <div class="brand">
        <el-icon :size="20"><Message /></el-icon>
        <span>{{ $t('brand') }}</span>
      </div>

      <!-- Menu — route-driven active state (no el-menu internal state
           machine, which caused a double-highlight glitch when EP's
           is-active class lagged behind the router). -->
      <nav class="aside-menu">
        <div
          v-for="item in menu"
          :key="item.path"
          class="menu-item"
          :class="{ active: activeMenu === item.path }"
          @click="go(item.path)"
        >
          <el-icon :size="18" :class="item.color"><component :is="item.icon" /></el-icon>
          <span class="menu-name">{{ $t(item.label) }}</span>
        </div>
      </nav>

      <!-- Folders (separate section, divider above) -->
      <FolderSection />
    </div>
  </el-scrollbar>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Message, MessageBox, Star, User, Setting } from "@element-plus/icons-vue";
import FolderSection from "./FolderSection.vue";

const route = useRoute();
const router = useRouter();
const activeMenu = computed(() => "/" + (route.path.split("/")[1] || "inbox"));

// Navigate to the target path. When going to /inbox, always clear the
// folder query param so it resets to the full inbox view (fixes the bug
// where clicking Inbox while inside a folder kept showing folder content).
function go(path) {
  if (path === "/inbox") {
    // Always push /inbox without query — even if we're already "on" /inbox
    // with a ?folder=X param, we want to clear that filter.
    if (route.path === "/inbox" && !route.query.folder) return; // truly same
    router.push({ path: "/inbox", query: {} });
  } else {
    if (activeMenu.value !== path) router.push(path);
  }
}

// SF Symbols color mapping mirrors macOS Mail: mail ops = blue,
// favorites = gold, system items = gray.
const menu = [
  { path: "/inbox",    label: "menu.inbox",    icon: MessageBox, color: "sf-blue" },
  { path: "/starred",  label: "menu.starred",  icon: Star,       color: "sf-yellow" },
  { path: "/accounts", label: "menu.accounts", icon: User,       color: "sf-gray" },
  { path: "/settings", label: "menu.settings", icon: Setting,    color: "sf-gray" },
];
</script>

<style scoped>
.aside-scroll {
  height: 100%;
}
.aside-inner {
  width: 100%;
  padding: 6px 0;
}
.brand {
  margin: var(--space-sm) var(--space-sm) var(--space-md);
  height: 42px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  font-size: var(--text-base);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #ffffff;
  background: var(--brand-gradient);
  user-select: none;
}
.aside-menu {
  padding: 0 var(--space-xs);
}
/* --- Individual menu items: macOS sidebar row --- */
.menu-item {
  display: flex;
  align-items: center;
  height: 36px;
  margin: 2px 0;
  padding: 0 var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 400;
  color: var(--aside-text);
  background: transparent;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s ease;
}
.menu-item:hover {
  background: var(--row-hover);
}
.menu-item.active {
  font-weight: 600;
  color: var(--row-active-text);
  background: var(--row-active);
}
/* Selected row: icon turns white to read on the blue fill. */
.menu-item.active .el-icon {
  color: #ffffff !important;
}
.menu-name {
  margin-left: 10px;
}
/* SF Symbols multicolor icon classes */
.sf-blue   { color: var(--sf-blue); }
.sf-yellow { color: var(--sf-yellow); }
.sf-gray   { color: var(--sf-gray); }
.sf-red    { color: var(--sf-red); }
.sf-green  { color: var(--sf-green); }
.sf-purple { color: var(--sf-purple); }
.sf-orange { color: var(--sf-orange); }
</style>
