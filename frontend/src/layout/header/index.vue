<template>
  <div class="header">
    <div class="left">
      <el-icon class="icon-btn hamburger" :size="22" @click="uiStore.toggleAside()">
        <Fold v-if="uiStore.asideShow" />
        <Expand v-else />
      </el-icon>
      <span class="title">{{ title }}</span>
    </div>

    <div class="right">
      <el-icon class="icon-btn" :size="22" @click="uiStore.toggleTheme($event)"
        :title="uiStore.isDark ? t('header.lightMode') : t('header.darkMode')">
        <Sunny v-if="uiStore.isDark" />
        <Moon v-else />
      </el-icon>

      <el-dropdown trigger="click" @command="onCommand">
        <span class="avatar">N</span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="accounts">
              <el-icon><User /></el-icon> {{ t('header.accounts') }}
            </el-dropdown-item>
            <el-dropdown-item command="settings">
              <el-icon><Setting /></el-icon> {{ t('header.settings') }}
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided>
              <el-icon><SwitchButton /></el-icon> {{ t('header.logout') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Fold, Expand, Sunny, Moon, User, Setting, SwitchButton } from "@element-plus/icons-vue";
import { useUiStore } from "@/store/ui";

const { t } = useI18n();
const uiStore = useUiStore();
const route = useRoute();
const router = useRouter();

const TITLE_KEYS = {
  inbox: "menu.inbox",
  starred: "menu.starred",
  settings: "menu.settings",
  accounts: "menu.accounts",
};
const title = computed(() => t(TITLE_KEYS[route.path.split("/")[1]] ?? "menu.inbox"));

function onCommand(cmd) {
  if (cmd === "logout") {
    localStorage.removeItem("token");
    router.replace("/login");
  } else {
    router.push("/" + cmd);
  }
}
</script>

<style scoped>
.header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  flex: 1;
}
.left, .right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.icon-btn {
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-regular);
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--row-hover);
  color: var(--el-text-color-primary);
}
.icon-btn:active {
  background: var(--row-hover);
  filter: brightness(0.94);
}
.title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-color);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.avatar:hover { opacity: 0.85; }
</style>
