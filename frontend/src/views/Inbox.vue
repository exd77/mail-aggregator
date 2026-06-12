<template>
  <div class="inbox" :class="mobileClass">
    <!-- Account panel: always visible (matches the reference layout). -->
    <div class="acct-col" :style="{ width: uiStore.acctPanelWidth + 'px' }" ref="acctColRef">
      <AccountPanel
        :accounts="visibleAccounts"
        :selected-id="filterAccount"
        :syncing="syncing"
        @add="showAdd = true"
        @sync-all="syncAll"
        @sync-one="syncOne"
        @remove="removeAccount"
        @select="selectAccount"
        @reorder="reorderAccounts"
        @set-label="setLabel"
      />
      <!-- Drag handle to resize the account column -->
      <div class="resize-handle" @mousedown="onAcctResizeStart"></div>
    </div>

    <!-- Right pane: swap between mail list and reader. -->
    <div v-if="!readerOpen" class="list-col">
      <MailList
        :messages="messages"
        :loading="loading"
        :active-id="selected?.id"
        :show-back="isMobile"
        @open="open"
        @toggle-star="toggleStar"
        @refresh="syncAll"
        @back="backToAccounts"
      />
    </div>
    <div v-else class="reader-col">
      <MailReader
        :detail="detail"
        :loading="detailLoading"
        @back="closeReader"
        @toggle-star="toggleStar"
      />
    </div>

    <AddAccountDialog v-model="showAdd" @added="onAccountAdded" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { apiInbox, apiMail, apiAccounts, apiSyncAll, apiSyncAccount, apiDeleteAccount, apiToggleStar, apiReorderAccounts, apiSetAccountLabel } from "@/api";
import { useUiStore } from "@/store/ui";
import { useResizable } from "@/composables/useResizable";
import AccountPanel from "@/components/AccountPanel.vue";
import MailList from "@/components/MailList.vue";
import MailReader from "@/components/MailReader.vue";
import AddAccountDialog from "@/components/AddAccountDialog.vue";

const { t } = useI18n();
const uiStore = useUiStore();
const acctColRef = ref(null);
const route = useRoute();

/**
 * Mobile single-pane navigation. On narrow screens we can't show the
 * account column and the list/reader side-by-side, so we switch between
 * them: accounts → list → reader. `mobilePane` tracks which of the first
 * two is showing; the reader is layered on top via readerOpen.
 */
const isMobile = ref(window.innerWidth < 768);
const mobilePane = ref("accounts"); // 'accounts' | 'list'
const mobileClass = computed(() => {
  if (!isMobile.value) return "";
  if (readerOpen.value) return "m-reader";
  return mobilePane.value === "list" ? "m-list" : "m-accounts";
});
function onWinResize() {
  isMobile.value = window.innerWidth < 768;
}
function backToAccounts() {
  mobilePane.value = "accounts";
}

/**
 * Folder filter is driven by the URL query (?folder=ID). The aside's
 * FolderSection writes this when the user clicks a folder; we react
 * here to reload the inbox + scope the account panel.
 */
const folderId = computed(() => {
  const q = route.query.folder;
  return q ? Number(q) : null;
});

watch(folderId, async () => {
  // When switching folders, drop any account-level filter and any open mail.
  filterAccount.value = null;
  if (readerOpen.value) closeReader();
  await Promise.all([loadAccounts(), load()]);
});

const { startResize: onAcctResizeStart } = useResizable({
  // The column's left edge — anchored to wherever it sits in the layout
  // (after the main aside). Recompute on each drag in case the aside
  // was resized in the meantime.
  getStartLeft: () => acctColRef.value?.getBoundingClientRect().left ?? 0,
  min: 200,
  max: 520,
  onUpdate: (w) => uiStore.setAcctPanelWidth(w),
});
const accounts = ref([]);
const messages = ref([]);
const filterAccount = ref(null);
const selected = ref(null);
const detail = ref(null);
const loading = ref(false);
const detailLoading = ref(false);
const syncing = ref(false);
const showAdd = ref(false);
const readerOpen = ref(false);

async function load() {
  loading.value = true;
  try {
    const params = { limit: 100 };
    if (filterAccount.value) params.accountId = filterAccount.value;
    else if (folderId.value) params.folderId = folderId.value;
    messages.value = await apiInbox(params);
  } finally { loading.value = false; }
}
async function loadAccounts() { accounts.value = await apiAccounts(); }

/**
 * Accounts to show in the side panel. When a folder is active, only
 * accounts assigned to that folder are visible.
 */
const visibleAccounts = computed(() => {
  if (!folderId.value) return accounts.value;
  return accounts.value.filter((a) => a.folder_id === folderId.value);
});

function selectAccount(id) {
  filterAccount.value = id;
  // If we're inside a mail, kembali ke list view dan tampilkan inbox akun terpilih
  if (readerOpen.value) closeReader();
  // On mobile, advance to the list pane so the user sees the messages.
  if (isMobile.value) mobilePane.value = "list";
  load();
}

async function open(m) {
  selected.value = m;
  readerOpen.value = true;
  detailLoading.value = true;
  try { detail.value = await apiMail(m.id); m.is_unread = 0; }
  finally { detailLoading.value = false; }
}

function closeReader() {
  readerOpen.value = false;
  selected.value = null;
  detail.value = null;
}

async function toggleStar(m) {
  try {
    const r = await apiToggleStar(m.id);
    m.is_starred = r.is_starred;
    if (detail.value?.id === m.id) detail.value.is_starred = r.is_starred;
    // sync the row in the list cache too
    const row = messages.value.find((x) => x.id === m.id);
    if (row) row.is_starred = r.is_starred;
  } catch { /* interceptor */ }
}

async function syncAll() {
  syncing.value = true;
  try {
    const r = await apiSyncAll();
    const emails = r.reduce((s, x) => s + (x.fetched || 0), 0);
    ElMessage.success(t("toast.synced", { accounts: r.length, emails }));
    await Promise.all([loadAccounts(), load()]);
  } finally { syncing.value = false; }
}
async function syncOne(id) {
  try {
    const r = await apiSyncAccount(id);
    ElMessage.success(t("toast.fetched", { fetched: r.fetched, total: r.total }));
    await Promise.all([loadAccounts(), load()]);
  } catch { /* interceptor */ }
}
async function removeAccount(id) {
  await apiDeleteAccount(id);
  ElMessage.success(t("toast.accountRemoved"));
  if (filterAccount.value === id) filterAccount.value = null;
  await Promise.all([loadAccounts(), load()]);
}
async function reorderAccounts(ids) {
  try {
    accounts.value = await apiReorderAccounts(ids);
  } catch { /* interceptor */ }
}
async function setLabel({ id, label }) {
  try {
    await apiSetAccountLabel(id, label);
    const a = accounts.value.find((x) => x.id === id);
    if (a) a.label = label || null;
  } catch { /* interceptor */ }
}
function onAccountAdded() {
  // Refresh immediately so the new account appears in the panel,
  // then again after a short delay to pick up the auto-sync result.
  Promise.all([loadAccounts(), load()]);
  setTimeout(() => Promise.all([loadAccounts(), load()]), 4000);
  setTimeout(() => Promise.all([loadAccounts(), load()]), 9000);
}

// When the global notifier detects new mail, refresh the visible list +
// unread badges (but don't disturb the reader if the user is reading).
function onMailNew() {
  loadAccounts();
  if (!readerOpen.value) load();
}

onMounted(async () => {
  await loadAccounts();
  await load();
  window.addEventListener("resize", onWinResize);
  window.addEventListener("mail:new", onMailNew);
  window.addEventListener("folder:changed", loadAccounts);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", onWinResize);
  window.removeEventListener("mail:new", onMailNew);
  window.removeEventListener("folder:changed", loadAccounts);
});
</script>

<style scoped>
.inbox { display: flex; height: 100%; }
.acct-col {
  flex-shrink: 0;
  border-right: 1px solid var(--hairline);
  position: relative;
  background: var(--content-bg);
}
.list-col, .reader-col { flex: 1; min-width: 0; }
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

/* =========================================================
   Mobile single-pane navigation (< 768px)
   Only ONE column is visible at a time. The account column
   takes the full width; selecting an account swaps to the
   list, opening a mail swaps to the reader. The resize
   handle is irrelevant on touch, so it's hidden.
   ========================================================= */
@media (max-width: 767px) {
  .inbox .acct-col {
    width: 100% !important;
    border-right: 0;
  }
  .inbox .list-col,
  .inbox .reader-col {
    width: 100%;
  }
  .inbox .resize-handle { display: none; }

  /* Show the account column, hide the list/reader. */
  .inbox.m-accounts .acct-col { display: flex; }
  .inbox.m-accounts .list-col,
  .inbox.m-accounts .reader-col { display: none; }

  /* Show the list, hide the account column. */
  .inbox.m-list .acct-col { display: none; }
  .inbox.m-list .list-col { display: block; }

  /* Reader is open (full screen). */
  .inbox.m-reader .acct-col { display: none; }
  .inbox.m-reader .reader-col { display: block; }
}
</style>
