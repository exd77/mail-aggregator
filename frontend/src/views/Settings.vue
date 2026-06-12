<template>
  <el-scrollbar class="settings">
    <div class="inner">
      <!-- Profile hero -->
      <div class="hero">
        <div class="avatar">
          <el-icon><UserFilled /></el-icon>
        </div>
        <div class="hero-meta">
          <div class="hero-name">admin</div>
          <div class="hero-sub">{{ t('settings.admin') }} · {{ accountCount }} {{ t('settings.connectedAccounts').toLowerCase() }}</div>
        </div>
      </div>

      <!-- PROFILE -->
      <h3 class="section">{{ t('settings.profile') }}</h3>
      <div class="group">
        <div class="row">
          <div class="row-ico" style="background:var(--sf-gray)"><el-icon><User /></el-icon></div>
          <span class="row-label">{{ t('settings.username') }}</span>
          <span class="row-value">admin</span>
        </div>
        <div class="row">
          <div class="row-ico" style="background:var(--sf-purple)"><el-icon><Key /></el-icon></div>
          <span class="row-label">{{ t('settings.role') }}</span>
          <span class="row-value">{{ t('settings.admin') }}</span>
        </div>
        <div class="row tappable" @click="router.push('/accounts')">
          <div class="row-ico" style="background:var(--sf-blue)"><el-icon><Message /></el-icon></div>
          <span class="row-label">{{ t('settings.connectedAccounts') }}</span>
          <span class="row-value">
            <span class="badge">{{ accountCount }}</span>
            <el-icon class="chevron"><ArrowRight /></el-icon>
          </span>
        </div>
      </div>

      <!-- APPEARANCE -->
      <h3 class="section">{{ t('settings.appearance') }}</h3>
      <div class="group">
        <div class="row">
          <div class="row-ico" style="background:var(--sf-gray)"><el-icon><Brush /></el-icon></div>
          <span class="row-label">{{ t('settings.theme') }}</span>
          <span class="row-value">
            <div class="segmented">
              <button
                :class="['seg', { active: uiStore.theme === 'dark' }]"
                @click="onThemeClick($event, 'dark')"
              >
                <el-icon><Moon /></el-icon>{{ t('settings.dark') }}
              </button>
              <button
                :class="['seg', { active: uiStore.theme === 'light' }]"
                @click="onThemeClick($event, 'light')"
              >
                <el-icon><Sunny /></el-icon>{{ t('settings.light') }}
              </button>
            </div>
          </span>
        </div>
      </div>

      <!-- LANGUAGE -->
      <h3 class="section">{{ t('settings.language') }}</h3>
      <div class="group">
        <div class="row">
          <div class="row-ico" style="background:var(--sf-green)"><el-icon><ChatDotRound /></el-icon></div>
          <span class="row-label">{{ t('settings.displayLanguage') }}</span>
          <span class="row-value">
            <el-select :model-value="locale" @change="setLang" class="lang-select" size="default">
              <el-option v-for="l in langs" :key="l.code" :label="l.label" :value="l.code" />
            </el-select>
          </span>
        </div>
      </div>

      <!-- SECURITY -->
      <h3 class="section">{{ t('settings.security') }}</h3>
      <div class="group">
        <div class="pw-head">
          <div class="row-ico" style="background:var(--sf-orange)"><el-icon><Lock /></el-icon></div>
          <div class="pw-head-text">
            <span class="row-label">{{ t('settings.changePassword') }}</span>
          </div>
        </div>
        <div class="pw-body">
          <el-input
            v-model="pw.current"
            type="password"
            show-password
            :placeholder="t('settings.currentPassword')"
            :prefix-icon="Lock"
            autocomplete="current-password"
            @keyup.enter="submitPassword"
          />
          <el-input
            v-model="pw.next"
            type="password"
            show-password
            :placeholder="t('settings.newPassword')"
            :prefix-icon="Key"
            autocomplete="new-password"
            @keyup.enter="submitPassword"
          />
          <el-input
            v-model="pw.confirm"
            type="password"
            show-password
            :placeholder="t('settings.confirmPassword')"
            :prefix-icon="Key"
            autocomplete="new-password"
            @keyup.enter="submitPassword"
          />
          <el-button type="primary" :loading="pwLoading" @click="submitPassword">
            {{ t('settings.updatePassword') }}
          </el-button>
        </div>
      </div>

      <!-- BACKUP & RESTORE -->
      <h3 class="section">{{ t('settings.backup') }}</h3>
      <p class="group-hint">{{ t('settings.backupHint') }}</p>
      <div class="group">
        <div class="row tappable" :class="{ disabled: exporting }" @click="onExport">
          <div class="row-ico" style="background:var(--sf-blue)"><el-icon><Download /></el-icon></div>
          <div class="row-stack">
            <span class="row-label">{{ t('settings.exportData') }}</span>
            <span class="row-hint">{{ exporting ? t('settings.exporting') : t('settings.exportSub') }}</span>
          </div>
          <el-icon class="chevron" :class="{ spin: exporting }">
            <Loading v-if="exporting" /><ArrowRight v-else />
          </el-icon>
        </div>
        <div class="row tappable" :class="{ disabled: importing }" @click="triggerImport">
          <div class="row-ico" style="background:var(--sf-green)"><el-icon><Upload /></el-icon></div>
          <div class="row-stack">
            <span class="row-label">{{ t('settings.importData') }}</span>
            <span class="row-hint">{{ importing ? t('settings.importing') : t('settings.importSub') }}</span>
          </div>
          <el-icon class="chevron" :class="{ spin: importing }">
            <Loading v-if="importing" /><ArrowRight v-else />
          </el-icon>
        </div>
      </div>
      <!-- Hidden file input drives the import flow -->
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        style="display:none"
        @change="onFilePicked"
      />

      <!-- SESSION -->
      <h3 class="section">{{ t('settings.session') }}</h3>
      <div class="group">
        <div class="row session-row" @click="logout">
          <div class="row-ico" style="background:var(--sf-red)"><el-icon><SwitchButton /></el-icon></div>
          <div class="row-stack">
            <span class="row-label danger">{{ t('settings.logout') }}</span>
            <span class="row-hint">{{ t('settings.sessionHint') }}</span>
          </div>
          <el-icon class="chevron"><ArrowRight /></el-icon>
        </div>
      </div>

      <div class="footer-note">Mail Aggregator</div>
    </div>
  </el-scrollbar>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { useUiStore } from "@/store/ui";
import { apiAccounts, apiChangePassword, apiImportBackup, downloadBackup } from "@/api";
import {
  UserFilled, User, Key, Message, Brush, Moon, Sunny,
  ChatDotRound, SwitchButton, ArrowRight, Lock, Download, Upload, Loading,
} from "@element-plus/icons-vue";

const { t, locale } = useI18n();
const uiStore = useUiStore();
const router = useRouter();
const accountCount = ref(0);

const langs = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "jv", label: "Jawa" },
  { code: "su", label: "Sunda" },
];

function setLang(code) {
  locale.value = code;    // switch vue-i18n locale reactively
  uiStore.setLang(code);  // persist to localStorage
}

/**
 * Click handler on the theme segmented control. We pass the click event
 * so the View Transition reveal can anchor on the actual click point.
 */
function onThemeClick(event, target) {
  if (uiStore.theme === target) return;
  uiStore.toggleTheme(event); // only two themes, so toggle == set to other
}

/* ---- Change password ---- */
const pw = reactive({ current: "", next: "", confirm: "" });
const pwLoading = ref(false);

async function submitPassword() {
  if (!pw.current || !pw.next || !pw.confirm) {
    ElMessage.warning(t("settings.fillAllFields"));
    return;
  }
  if (pw.next.length < 6) {
    ElMessage.warning(t("settings.passwordTooShort"));
    return;
  }
  if (pw.next !== pw.confirm) {
    ElMessage.warning(t("settings.passwordMismatch"));
    return;
  }
  pwLoading.value = true;
  try {
    await apiChangePassword(pw.current, pw.next);
    ElMessage.success(t("settings.passwordChanged"));
    pw.current = pw.next = pw.confirm = "";
  } catch { /* interceptor surfaces the error message */ }
  finally { pwLoading.value = false; }
}

/* ---- Backup: export ---- */
const exporting = ref(false);
async function onExport() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const file = await downloadBackup();
    ElMessage.success(t("settings.exported", { file }));
  } catch (e) {
    ElMessage.error(e.message || t("settings.exportFailed"));
  } finally {
    exporting.value = false;
  }
}

/* ---- Backup: import ---- */
const fileInput = ref(null);
const importing = ref(false);
function triggerImport() {
  if (importing.value) return;
  fileInput.value?.click();
}
async function onFilePicked(e) {
  const file = e.target.files?.[0];
  e.target.value = ""; // reset so picking the same file again re-triggers
  if (!file) return;

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    ElMessage.error(t("settings.importFailed"));
    return;
  }

  try {
    await ElMessageBox.confirm(t("settings.importConfirm"), t("settings.importConfirmTitle"), {
      confirmButtonText: t("settings.confirm"),
      cancelButtonText: t("settings.cancel"),
      type: "warning",
    });
  } catch {
    return; // user cancelled
  }

  importing.value = true;
  try {
    const r = await apiImportBackup(backup);
    ElMessage.success(t("settings.imported", { added: r.added, updated: r.updated }));
    accountCount.value = (await apiAccounts()).length;
    window.dispatchEvent(new CustomEvent("folder:changed"));
  } catch (e) {
    ElMessage.error(e?.message || t("settings.importFailed"));
  } finally {
    importing.value = false;
  }
}

function logout() {
  localStorage.removeItem("token");
  router.replace("/login");
}

onMounted(async () => {
  try { accountCount.value = (await apiAccounts()).length; } catch { /* ignore */ }
});
</script>

<style scoped>
.settings { height: 100%; background: var(--el-fill-color-light); }
.inner {
  /* Roomier desktop column — matches iCloud Mail / System Settings width. */
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-lg) 56px;
}

/* ---- Profile hero ---- */
.hero {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xs) 4px var(--space-md);
  margin-bottom: var(--space-md);
}
.avatar {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: var(--brand-gradient);
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-size: 34px;
  box-shadow: 0 4px 14px rgba(0, 122, 255, 0.28);
  flex-shrink: 0;
}
.hero-meta { min-width: 0; }
.hero-name {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}
.hero-sub {
  font-size: var(--text-sm);
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

/* ---- Section label ---- */
.section {
  margin: var(--space-lg) 0 var(--space-xs);
  padding: 0 var(--space-md);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--el-text-color-secondary);
}
.group-hint {
  margin: -2px 0 var(--space-xs);
  padding: 0 var(--space-md);
  font-size: var(--text-xs);
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

/* ---- Grouped inset card (System Settings style) ---- */
.group {
  background: var(--el-bg-color);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 10px var(--space-md);
  min-height: 52px;
  position: relative;
}
.row + .row::before,
.pw-body::before {
  content: "";
  position: absolute;
  top: 0; left: 56px; right: 0;
  height: 1px;
  background: var(--hairline);
}
.row-ico {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-size: 17px;
  flex-shrink: 0;
}
.row-label {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.row-value {
  margin-left: auto;
  font-size: var(--text-base);
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
}
.row-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.row-hint {
  font-size: var(--text-xs);
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
.badge {
  min-width: 24px;
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  background: var(--sf-blue);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ---- Segmented control (theme) ---- */
.segmented {
  display: inline-flex;
  background: var(--el-fill-color);
  border-radius: 9px;
  padding: 2px;
  gap: 2px;
}
.seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 7px;
  font-size: var(--text-sm);
  font-weight: 510;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.seg .el-icon { font-size: 15px; }
.seg.active {
  background: var(--brand-color);
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

/* ---- Language select ---- */
.lang-select { width: 180px; }

/* ---- Password block ---- */
.pw-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 12px var(--space-md);
}
.pw-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  position: relative;
}
.pw-body .el-button { align-self: flex-start; }

/* ---- Tappable row (navigates / acts) ---- */
.row.tappable { cursor: pointer; transition: background 0.15s; }
.row.tappable:hover { background: var(--row-hover); }
.row.tappable .row-value { gap: var(--space-xs); }
.row.disabled { pointer-events: none; opacity: 0.6; }

/* ---- Session row (tappable) ---- */
.session-row { cursor: pointer; transition: background 0.15s; }
.session-row:hover { background: var(--row-hover); }
.row-label.danger { color: var(--sf-red); font-weight: 600; }
.chevron {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  flex-shrink: 0;
}
.chevron.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.footer-note {
  text-align: center;
  margin-top: var(--space-lg);
  font-size: var(--text-xs);
  color: var(--el-text-color-placeholder);
}

/* ---- Mobile ---- */
@media (max-width: 767px) {
  .inner { padding: var(--space-md) var(--space-sm) 40px; }
  .hero { padding: 4px 6px var(--space-sm); gap: var(--space-sm); }
  .avatar { width: 60px; height: 60px; font-size: 28px; }
  .hero-name { font-size: 22px; }
  .row { padding: var(--space-sm) var(--space-sm); min-height: 52px; }
  .row + .row::before { left: 48px; }
  .lang-select { width: 150px; }
  .section { padding: 0 var(--space-sm); }
  .group-hint { padding: 0 var(--space-sm); }
}
</style>
