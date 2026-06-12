<template>
  <div class="acct-panel">
    <div class="acct-toolbar">
      <el-icon class="tb-icon" :size="20" @click="$emit('add')" :title="t('account.addAccount')"><Plus /></el-icon>
      <el-icon class="tb-icon" :size="19" :class="{ spin: syncing }" @click="$emit('sync-all')" :title="t('account.syncAll')"><Refresh /></el-icon>
    </div>

    <!-- Search bar -->
    <div class="search-box">
      <el-input v-model="search" :placeholder="t('account.searchPlaceholder')" size="small" clearable :prefix-icon="Search" />
    </div>

    <el-scrollbar class="acct-scroll">
      <div class="acct-card" :class="{ active: selectedId === null }" @click="$emit('select', null)">
        <div class="acct-email">{{ t('account.allAccounts') }}</div>
        <div class="acct-actions">
          <span class="badge">{{ accounts.length }}</span>
        </div>
      </div>

      <div v-for="(a, idx) in filtered" :key="a.id" class="acct-card"
        :class="{ active: selectedId === a.id, 'drag-over': dragOverId === a.id }"
        :draggable="!search && editingId !== a.id"
        @click="onCardClick(a)"
        @dragstart="onDragStart($event, idx, a)"
        @dragover.prevent="onDragOver(a)"
        @dragleave="dragOverId = null"
        @drop.prevent="onDrop(idx)"
        @dragend="onDragEnd"
      >
        <!-- Label or email — switches to inline input while editing -->
        <div class="acct-email" :title="a.email">
          <el-input
            v-if="editingId === a.id"
            v-model="editingValue"
            size="small"
            ref="editInputRef"
            :placeholder="a.email"
            @click.stop
            @keyup.enter="commitLabel(a)"
            @keyup.esc="cancelEdit"
            @blur="commitLabel(a)"
            maxlength="40"
          />
          <template v-else>
            <span class="primary">{{ a.label || a.email }}</span>
            <span v-if="a.label" class="sub-email">{{ a.email }}</span>
          </template>
        </div>

        <div class="acct-actions">
          <el-icon class="ac-icon" :size="16" @click.stop="copyEmail(a.email)" :title="t('account.copyEmail')"><DocumentCopy /></el-icon>
          <el-icon class="ac-icon" :size="16" @click.stop="startEdit(a)" :title="t('account.editLabel')"><EditPen /></el-icon>
          <el-icon class="ac-icon" :size="16" @click.stop="$emit('sync-one', a.id)" :title="t('account.sync')"><Refresh /></el-icon>
          <el-icon class="ac-icon danger" :size="16" @click.stop="askRemove(a)" :title="t('account.remove')"><Delete /></el-icon>
          <span class="badge" v-if="a.unread_count">{{ a.unread_count }}</span>
        </div>
      </div>

      <div class="end" v-if="!filtered.length && search">{{ t('list.noMoreData') }}</div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { Plus, Refresh, Delete, DocumentCopy, Search, EditPen } from "@element-plus/icons-vue";
import { copyToClipboard } from "@/utils/format";
import { confirm } from "@/composables/useConfirm";

const { t } = useI18n();
const props = defineProps({
  accounts: { type: Array, default: () => [] },
  selectedId: { type: [Number, String], default: null },
  syncing: { type: Boolean, default: false },
});
const emit = defineEmits(["add", "sync-all", "sync-one", "remove", "select", "reorder", "set-label"]);

const search = ref("");
const filtered = computed(() => {
  if (!search.value) return props.accounts;
  const q = search.value.toLowerCase();
  return props.accounts.filter((a) =>
    (a.email || "").toLowerCase().includes(q) ||
    (a.display_name || "").toLowerCase().includes(q) ||
    (a.label || "").toLowerCase().includes(q)
  );
});

// ---- Inline label edit ----
const editingId = ref(null);
const editingValue = ref("");
const editInputRef = ref(null);

function startEdit(a) {
  editingId.value = a.id;
  editingValue.value = a.label || "";
  // focus the input after it's rendered
  setTimeout(() => editInputRef.value?.[0]?.focus?.() ?? editInputRef.value?.focus?.(), 0);
}
function cancelEdit() {
  editingId.value = null;
  editingValue.value = "";
}
function commitLabel(a) {
  if (editingId.value !== a.id) return;
  const next = editingValue.value.trim();
  if ((a.label || "") !== next) emit("set-label", { id: a.id, label: next });
  cancelEdit();
}
function onCardClick(a) {
  // While editing, ignore card-level clicks so the user can interact with the input.
  if (editingId.value === a.id) return;
  emit("select", a.id);
}

// ---- Drag & Drop reorder ----
const dragIdx = ref(null);
const dragOverId = ref(null);

function onDragStart(event, idx, a) {
  if (editingId.value === a.id) { event.preventDefault(); return; }
  dragIdx.value = idx;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(a.id));
  // Custom MIME so drop targets outside the panel (e.g. folder section
  // in the aside) can identify a mail-account drag and accept it.
  event.dataTransfer.setData("application/x-mail-account-id", String(a.id));
}
function onDragOver(a) {
  dragOverId.value = a.id;
}
function onDrop(dropIdx) {
  dragOverId.value = null;
  if (dragIdx.value === null || dragIdx.value === dropIdx) return;
  // Compute new order from the full (unfiltered) accounts list
  const ids = props.accounts.map((a) => a.id);
  const [moved] = ids.splice(dragIdx.value, 1);
  ids.splice(dropIdx, 0, moved);
  emit("reorder", ids);
}
function onDragEnd() {
  dragIdx.value = null;
  dragOverId.value = null;
}

async function copyEmail(email) {
  const ok = await copyToClipboard(email);
  ok ? ElMessage.success(t("toast.copied")) : ElMessage.warning(t("toast.copyFail"));
}

async function askRemove(a) {
  const ok = await confirm({
    title: t("account.removeTitle"),
    message: t("account.confirmRemove"),
    confirmText: t("folder.delete"),
    cancelText: t("folder.cancel"),
    danger: true,
  });
  if (ok) emit("remove", a.id);
}
</script>

<style scoped>
.acct-panel { display: flex; flex-direction: column; height: 100%; }
.acct-toolbar {
  display: flex; align-items: center; gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm); height: 48px;
  border-bottom: 1px solid var(--hairline);
}
.tb-icon {
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
.tb-icon:hover {
  background: var(--row-hover);
  color: var(--el-text-color-primary);
}
.search-box {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--hairline);
}
.acct-scroll { flex: 1; padding: var(--space-sm); }
.acct-card {
  border: 1px solid var(--hairline); border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-sm); cursor: pointer;
  transition: all 0.12s; display: flex; flex-direction: column; gap: var(--space-sm);
  background: var(--el-fill-color-blank);
}
.acct-card[draggable="true"] { cursor: grab; }
.acct-card[draggable="true"]:active { cursor: grabbing; }
.acct-card:hover { border-color: var(--brand-color); }
.acct-card.active {
  border-color: var(--brand-color);
  background: var(--row-active);
}
.acct-card.active .acct-email,
.acct-card.active .primary {
  color: var(--row-active-text);
}
.acct-card.active .sub-email {
  color: rgba(255, 255, 255, 0.7);
}
.acct-card.active .ac-icon,
.acct-card.active .badge {
  color: #fff;
}
.acct-card.drag-over {
  border-color: var(--brand-color);
  border-style: dashed;
  background: var(--row-hover);
}
.acct-email {
  font-size: var(--text-sm); font-weight: 600; color: var(--el-text-color-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acct-email .primary {
  display: block;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acct-email .sub-email {
  display: block;
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--el-text-color-placeholder);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 2px;
}
.acct-actions { display: flex; align-items: center; gap: var(--space-sm); }
.ac-icon {
  cursor: pointer;
  color: var(--sf-gray);
  transition: color 0.12s;
}
.ac-icon:hover { color: var(--el-text-color-primary); }
.ac-icon.danger:hover { color: var(--sf-red); }
.badge {
  margin-left: auto;
  background: var(--brand-color);
  color: #fff;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  padding: 2px var(--space-xs);
  font-weight: 500;
}
.end { text-align: center; padding: var(--space-md); font-size: var(--text-sm); color: var(--el-text-color-placeholder); }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* --- Mobile: larger touch targets, roomier cards, full-fill width --- */
@media (max-width: 767px) {
  /* Unify horizontal padding so toolbar, search and cards share the
     SAME left/right gutter — kills the right-side dead space and keeps
     everything edge-aligned. */
  .acct-toolbar { height: 52px; gap: 22px; padding: 0 16px; }
  .acct-toolbar .tb-icon { font-size: 22px !important; padding: 6px; }
  .search-box { padding: 12px 16px; }
  /* el-scrollbar can reserve a few px on the right for its track; force
     the inner view to span the full width so cards fill edge to edge. */
  .acct-scroll { padding: 12px 16px; }
  .acct-scroll :deep(.el-scrollbar__view) { width: 100%; }
  .acct-card {
    padding: 14px 16px;
    margin-left: 0;
    margin-right: 0;
    width: 100%;
    box-sizing: border-box;
  }
  .acct-email { font-size: 15px; }
  .acct-actions { gap: 18px; }
  .ac-icon { font-size: 20px !important; padding: 4px; }
}
</style>
