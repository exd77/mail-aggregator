<template>
  <el-scrollbar class="page">
    <div class="inner">
      <div class="head">
        <div>
          <h2>{{ t('account.title') }}</h2>
          <p class="sub">{{ t('account.totalCount', { count: accounts.length }) }}</p>
        </div>
        <div class="head-actions">
          <el-button :icon="Refresh" @click="syncAll" :loading="syncingAll" round>{{ t('account.syncAll') }}</el-button>
          <el-button type="primary" :icon="Plus" @click="showAdd = true" round>{{ t('account.addAccount') }}</el-button>
        </div>
      </div>

      <div class="search-bar" v-if="accounts.length > 0">
        <el-input
          v-model="searchQuery"
          :placeholder="t('account.searchPlaceholder')"
          :prefix-icon="Search"
          clearable
          size="large"
        />
      </div>

      <div v-if="!accounts.length && !loading" class="empty">
        <el-empty :description="t('account.emptyAccounts')" />
      </div>

      <div v-else-if="accounts.length > 0 && filteredAccounts.length === 0 && searchQuery" class="empty">
        <el-empty :description="t('account.noMatch')" />
      </div>

      <div class="grid" v-loading="loading">
        <div v-for="a in filteredAccounts" :key="a.id" class="acct-card" :class="{ 'has-error': a.last_error }">
          <div class="card-top">
            <div class="avatar-wrap">
              <el-avatar v-if="a.picture" :src="a.picture" :size="46" />
              <div v-else class="avatar-fallback" :style="{ background: avatarColor(a.email) }">
                {{ initial(a.email) }}
              </div>
              <span class="provider-dot" :style="{ background: providerColor(a.provider) }" :title="a.provider">
                <el-icon><Message /></el-icon>
              </span>
            </div>
            <div class="ident">
              <div class="email" :title="a.email">{{ a.email }}</div>
              <div class="name">{{ a.display_name || '—' }}</div>
            </div>
            <span class="status" :class="a.status === 'active' ? 'ok' : 'bad'">
              <span class="status-dot"></span>{{ a.status }}
            </span>
          </div>

          <div class="card-meta">
            <div class="meta-item">
              <span class="k">{{ t('account.provider') }}</span>
              <span class="v cap">{{ a.provider }} · {{ a.auth_type || 'oauth' }}</span>
            </div>
            <div class="meta-item">
              <span class="k">{{ t('account.unread') }}</span>
              <span class="v">
                <span v-if="a.unread_count" class="unread-pill">{{ a.unread_count }}</span>
                <span v-else class="muted">0</span>
              </span>
            </div>
            <div class="meta-item">
              <span class="k">{{ t('account.lastSync') }}</span>
              <span class="v">{{ a.last_sync ? relativeTime(a.last_sync * 1000) : t('account.never') }}</span>
            </div>
          </div>

          <div v-if="a.last_error" class="err" :title="a.last_error">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ a.last_error }}</span>
          </div>

          <div class="card-actions">
            <el-button size="small" :icon="Refresh" @click="syncOne(a.id)" :loading="syncing[a.id]" round>{{ t('account.sync') }}</el-button>
            <el-button size="small" type="danger" :icon="Delete" plain @click="askDel(a.id)">{{ t('account.remove') }}</el-button>
          </div>
        </div>
      </div>
    </div>
    <AddAccountDialog v-model="showAdd" @added="load" />
  </el-scrollbar>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { Plus, Refresh, Delete, Search, Message, WarningFilled } from "@element-plus/icons-vue";
import { apiAccounts, apiDeleteAccount, apiSyncAccount, apiSyncAll } from "@/api";
import { confirm } from "@/composables/useConfirm";
import { relativeTime } from "@/utils/format";
import AddAccountDialog from "@/components/AddAccountDialog.vue";

const { t } = useI18n();
const accounts = ref([]);
const loading = ref(false);
const syncing = reactive({});
const syncingAll = ref(false);
const showAdd = ref(false);
const searchQuery = ref("");

const filteredAccounts = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return accounts.value;
  return accounts.value.filter(
    (a) =>
      (a.email || "").toLowerCase().includes(q) ||
      (a.display_name || "").toLowerCase().includes(q) ||
      (a.provider || "").toLowerCase().includes(q)
  );
});

// Apple-ish palette for avatar fallbacks, picked deterministically from email.
const AVATAR_COLORS = [
  "linear-gradient(135deg,#1e8fff,#007aff)",
  "linear-gradient(135deg,#34c759,#28a745)",
  "linear-gradient(135deg,#ff9f0a,#ff9500)",
  "linear-gradient(135deg,#bf5af2,#af52de)",
  "linear-gradient(135deg,#ff6f61,#ff3b30)",
  "linear-gradient(135deg,#5ac8fa,#0a84ff)",
  "linear-gradient(135deg,#ffd60a,#ff9500)",
];
function avatarColor(email) {
  const s = email || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function providerColor(provider) {
  const p = (provider || "").toLowerCase();
  if (p.includes("gmail") || p.includes("google")) return "#ea4335";
  if (p.includes("outlook") || p.includes("microsoft") || p.includes("hotmail")) return "#0a84ff";
  if (p.includes("yahoo")) return "#6001d2";
  if (p.includes("icloud") || p.includes("apple")) return "#8e8e93";
  return "var(--sf-gray)";
}

async function load() {
  loading.value = true;
  try { accounts.value = await apiAccounts(); }
  finally { loading.value = false; }
}
function initial(email) { return (email || "?").charAt(0).toUpperCase(); }

async function syncOne(id) {
  syncing[id] = true;
  try {
    const r = await apiSyncAccount(id);
    ElMessage.success(t("toast.fetched", { fetched: r.fetched, total: r.total }));
    load();
  } catch { /* interceptor */ }
  finally { syncing[id] = false; }
}
async function syncAll() {
  syncingAll.value = true;
  try {
    const r = await apiSyncAll();
    const emails = r.reduce((s, x) => s + (x.fetched || 0), 0);
    ElMessage.success(t("toast.synced", { accounts: r.length, emails }));
    load();
  } finally { syncingAll.value = false; }
}
async function askDel(id) {
  const acct = accounts.value.find((a) => a.id === id);
  const confirmed = await confirm({
    title: t("account.removeTitle"),
    message: t("account.confirmRemove", { email: acct?.email || "" }),
    confirmText: t("account.remove"),
    cancelText: t("account.cancel"),
    danger: true,
  });
  if (!confirmed) return;
  try {
    await apiDeleteAccount(id);
    ElMessage.success(t("toast.accountRemoved"));
    load();
  } catch {
    // interceptor already shows error toast
  }
}
onMounted(load);
</script>

<style scoped>
.page { height: 100%; background: var(--el-fill-color-light); }
.inner { padding: 32px 32px 48px; max-width: 1100px; margin: 0 auto; }

/* ---- Header ---- */
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}
.head h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--el-text-color-primary); }
.sub { margin: 2px 0 0; font-size: var(--text-sm); color: var(--el-text-color-secondary); }
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.head-actions .el-button { white-space: nowrap; }
.search-bar { margin-bottom: 20px; }
.search-bar .el-input { max-width: 400px; }
.empty { padding: 48px 0; }

/* ---- Grid ---- */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }

/* ---- Card ---- */
.acct-card {
  border: 1px solid var(--hairline);
  border-radius: 14px;
  padding: 18px;
  background: var(--el-bg-color);
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}
.acct-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10);
  border-color: var(--hairline-strong);
}
.acct-card.has-error { border-color: color-mix(in srgb, var(--sf-red) 35%, var(--hairline)); }

/* ---- Top ---- */
.card-top { display: flex; align-items: center; gap: 13px; }
.avatar-wrap { position: relative; flex-shrink: 0; }
.avatar-fallback {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 19px; font-weight: 600;
}
.provider-dot {
  position: absolute; right: -2px; bottom: -2px;
  width: 19px; height: 19px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 10px;
  border: 2px solid var(--el-bg-color);
}
.ident { flex: 1; min-width: 0; }
.email { font-weight: 600; font-size: 15px; color: var(--el-text-color-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name { font-size: var(--text-xs); color: var(--el-text-color-secondary); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---- Status pill ---- */
.status {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px 3px 8px; border-radius: 980px;
  font-size: 11px; font-weight: 600; text-transform: capitalize;
  flex-shrink: 0;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; }
.status.ok { background: color-mix(in srgb, var(--sf-green) 15%, transparent); color: var(--sf-green); }
.status.ok .status-dot { background: var(--sf-green); }
.status.bad { background: color-mix(in srgb, var(--sf-red) 15%, transparent); color: var(--sf-red); }
.status.bad .status-dot { background: var(--sf-red); }

/* ---- Meta ---- */
.card-meta {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 13px 0;
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
}
.meta-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.meta-item .k { font-size: 11px; color: var(--el-text-color-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
.meta-item .v { font-size: var(--text-sm); font-weight: 500; color: var(--el-text-color-primary); }
.meta-item .v.cap { text-transform: capitalize; }
.muted { color: var(--el-text-color-placeholder); }
.unread-pill {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px;
  background: var(--sf-blue); color: #fff; font-size: 11px; font-weight: 600;
}

/* ---- Error ---- */
.err {
  display: flex; align-items: center; gap: 6px;
  font-size: var(--text-xs); color: var(--sf-red);
  background: color-mix(in srgb, var(--sf-red) 8%, transparent);
  padding: 8px 10px; border-radius: 8px;
}
.err span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.err .el-icon { flex-shrink: 0; }

/* ---- Actions ---- */
.card-actions { display: flex; gap: 10px; }

/* ---- Mobile ---- */
@media (max-width: 767px) {
  .inner {
    padding: var(--space-md) var(--space-sm) 48px;
  }
  .head {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  .head h2 { font-size: 22px; }
  .head-actions {
    width: 100%;
    flex-direction: row;
    gap: 8px;
  }
  .head-actions .el-button { flex: 1; }
  .search-bar { margin-bottom: var(--space-sm); }
  .search-bar .el-input { max-width: 100%; }
  .grid {
    grid-template-columns: 1fr;
    gap: var(--space-sm);
  }
  .acct-card {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    gap: var(--space-sm);
    overflow: hidden;
  }
  .card-top {
    gap: var(--space-sm);
    min-width: 0;
  }
  .avatar-wrap { flex-shrink: 0; }
  .avatar-fallback { width: 40px; height: 40px; font-size: 16px; }
  .provider-dot { width: 16px; height: 16px; font-size: 9px; }
  .ident { min-width: 0; flex: 1; }
  .email { font-size: 14px; }
  .name { font-size: 11px; }
  .status {
    flex-shrink: 0;
    font-size: 10px;
    padding: 2px 7px 2px 6px;
    gap: 4px;
  }
  .status-dot { width: 5px; height: 5px; }

  /* Meta: stack vertically on mobile */
  .card-meta {
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-sm) 0;
  }
  .meta-item {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
  }
  .meta-item .k {
    font-size: 11px;
    min-width: 70px;
    flex-shrink: 0;
  }
  .meta-item .v { font-size: 13px; text-align: right; }

  .card-actions { gap: 8px; }
  .card-actions .el-button { flex: 1; }
}

/* ---- Small phones ---- */
@media (max-width: 374px) {
  .inner { padding: var(--space-sm) 10px 48px; }
  .head h2 { font-size: 20px; }
  .head-actions { flex-direction: column; }
  .head-actions .el-button { width: 100%; }
}
</style>
