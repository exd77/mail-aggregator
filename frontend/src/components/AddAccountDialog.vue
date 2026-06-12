<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="t('add.title')"
    width="540px"
    class="mac-add-dialog"
    :close-on-click-modal="false"
    @closed="reset"
  >
    <el-tabs v-model="tab" class="mac-tabs">
      <el-tab-pane :label="t('add.tabOauth')" name="oauth">
        <div v-if="!flow" class="oauth-intro">
          <div class="info-card">{{ t('add.oauthIntro') }}</div>
          <el-button type="primary" class="primary-action" @click="startFlow" :loading="starting">
            {{ t('add.generateLink') }}
          </el-button>
        </div>
        <div v-else>
          <el-form label-position="top" class="mac-form">
            <el-form-item :label="t('add.step1')">
              <el-input :model-value="flow.authUrl" type="textarea" :rows="3" readonly />
              <div class="btn-row">
                <el-button size="small" :icon="CopyDocument" @click="copy(flow.authUrl)">{{ t('add.copyLink') }}</el-button>
                <el-button size="small" type="primary" @click="openLink">{{ t('add.openNewTab') }}</el-button>
              </div>
            </el-form-item>
            <el-form-item :label="t('add.step2')">
              <el-input v-model="codeInput" type="textarea" :rows="3" placeholder="http://localhost:8788/callback?code=***&state=..." />
            </el-form-item>
            <div class="form-actions">
              <el-button @click="cancelFlow">{{ t('add.cancel') }}</el-button>
              <el-button type="primary" @click="submitOAuth" :loading="submitting" :disabled="!codeInput">{{ t('add.submitConnect') }}</el-button>
            </div>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('add.tabImap')" name="imap">
        <el-form label-position="top" class="mac-form">
          <el-form-item :label="t('add.email')">
            <el-input v-model="imap.email" placeholder="you@example.com" @blur="detect" />
          </el-form-item>
          <el-form-item :label="t('add.password')">
            <el-input v-model="imap.password" type="password" show-password :placeholder="t('add.passwordPlaceholder')" />
          </el-form-item>
          <div class="field-row">
            <el-form-item :label="t('add.imapHost')" style="flex:2">
              <el-input v-model="imap.host" placeholder="imap.example.com" />
            </el-form-item>
            <el-form-item :label="t('add.port')" style="flex:1">
              <el-input v-model="imap.port" placeholder="993" />
            </el-form-item>
          </div>
          <el-form-item>
            <el-checkbox v-model="imap.secure">{{ t('add.useTls') }}</el-checkbox>
          </el-form-item>
          <div class="form-actions">
            <el-button type="primary" class="primary-action" @click="connectImap" :loading="connecting" :disabled="!imapValid">
              {{ t('add.connect') }}
            </el-button>
          </div>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { CopyDocument } from "@element-plus/icons-vue";
import { apiOAuthStart, apiOAuthStatus, apiOAuthSubmit, apiImapDetect, apiImapConnect } from "@/api";
import { copyToClipboard } from "@/utils/format";

const { t } = useI18n();
defineProps({ modelValue: { type: Boolean, default: false } });
const emit = defineEmits(["update:modelValue", "added"]);

const tab = ref("oauth");

/* ---- OAuth ---- */
const flow = ref(null);
const starting = ref(false);
const submitting = ref(false);
const codeInput = ref("");
let pollTimer = null;

async function startFlow() {
  starting.value = true;
  try {
    flow.value = await apiOAuthStart();
    pollTimer = setInterval(async () => {
      try {
        const s = await apiOAuthStatus(flow.value.state);
        if (s.status === "done") onSuccess(s.email);
        else if (s.status === "error") { ElMessage.error(s.error || t("toast.oauthFailed")); cancelFlow(); }
      } catch { /* ignore */ }
    }, 3000);
  } finally { starting.value = false; }
}
async function submitOAuth() {
  if (!flow.value || !codeInput.value) return;
  submitting.value = true;
  try {
    const r = await apiOAuthSubmit(flow.value.state, codeInput.value.trim());
    onSuccess(r.email);
  } catch { /* interceptor */ }
  finally { submitting.value = false; }
}
function openLink() { window.open(flow.value.authUrl, "_blank"); }
async function copy(text) {
  const ok = await copyToClipboard(text);
  ok ? ElMessage.success(t("toast.copied")) : ElMessage.warning(t("toast.copyFail"));
}
function cancelFlow() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  flow.value = null; codeInput.value = "";
}

/* ---- IMAP ---- */
const imap = reactive({ email: "", password: "", host: "", port: "993", secure: true });
const connecting = ref(false);
const imapValid = computed(() => imap.email && imap.password && imap.host && imap.port);

async function detect() {
  if (!imap.email) return;
  try {
    const info = await apiImapDetect(imap.email);
    if (info.autodetected && !info.blocked) {
      imap.host = info.host || imap.host;
      imap.port = String(info.port || imap.port);
      imap.secure = info.secure !== false;
      if (info.requiresAppPassword) ElMessage.info(t("add.needAppPassword", { name: info.name }));
    } else if (info.blocked) {
      ElMessage.warning(info.reason || t("add.imapBlocked"));
    }
  } catch { /* ignore */ }
}
async function connectImap() {
  connecting.value = true;
  try {
    const r = await apiImapConnect({ ...imap, port: Number(imap.port) });
    onSuccess(r.email);
  } catch { /* interceptor */ }
  finally { connecting.value = false; }
}

/* ---- shared ---- */
function onSuccess(email) {
  ElMessage.success(t("toast.connected", { email }));
  cancelFlow();
  emit("added");
  emit("update:modelValue", false);
}
function reset() {
  cancelFlow();
  Object.assign(imap, { email: "", password: "", host: "", port: "993", secure: true });
  tab.value = "oauth";
}
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
.oauth-intro {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* macOS-style info banner: soft tinted card, no harsh borders */
.info-card {
  background: var(--el-fill-color);
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--el-text-color-regular);
}
.btn-row {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}
.field-row {
  display: flex;
  gap: 12px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.primary-action {
  align-self: flex-start;
}
</style>

<!-- Global overrides: el-dialog teleports to <body>, so these can't be
     scoped. Class-namespaced to .mac-add-dialog to avoid leaking. -->
<style>
.mac-add-dialog {
  border-radius: 14px !important;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35) !important;
}
.mac-add-dialog .el-dialog__header {
  padding: 20px 24px 0;
  margin-right: 0;
}
.mac-add-dialog .el-dialog__title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}
.mac-add-dialog .el-dialog__headerbtn {
  top: 18px;
  right: 18px;
  width: 28px;
  height: 28px;
}
.mac-add-dialog .el-dialog__body {
  padding: 12px 24px 24px;
}

/* --- Segmented-control style tabs (macOS pill switcher) --- */
.mac-add-dialog .mac-tabs .el-tabs__header {
  margin: 0 0 20px;
}
.mac-add-dialog .mac-tabs .el-tabs__nav-wrap::after {
  display: none;                 /* kill the EP underline track */
}
.mac-add-dialog .mac-tabs .el-tabs__active-bar {
  display: none;                 /* kill the sliding underline */
}
.mac-add-dialog .mac-tabs .el-tabs__nav {
  background: var(--el-fill-color);
  border-radius: 9px;
  padding: 3px;
  display: flex;
  gap: 2px;
}
.mac-add-dialog .mac-tabs .el-tabs__item {
  height: 30px;
  line-height: 30px;
  padding: 0 18px !important;
  border-radius: 7px;
  font-size: var(--text-sm);
  font-weight: 510;
  color: var(--el-text-color-regular);
  transition: background 0.18s ease, color 0.18s ease;
}
.mac-add-dialog .mac-tabs .el-tabs__item.is-active {
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
}
html.dark .mac-add-dialog .mac-tabs .el-tabs__item.is-active {
  background: #48484a;
}
.mac-add-dialog .mac-tabs .el-tabs__item:hover {
  color: var(--el-text-color-primary);
}

/* --- Form fields --- */
.mac-add-dialog .mac-form .el-form-item__label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding-bottom: 4px;
}
.mac-add-dialog .mac-form .el-form-item {
  margin-bottom: 16px;
}
.mac-add-dialog .el-textarea__inner {
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  background: var(--el-fill-color);
  font-size: var(--text-xs);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
</style>

