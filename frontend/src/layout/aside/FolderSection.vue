<template>
  <div class="folder-section">
    <!-- Section header -->
    <div class="folder-head">
      <span class="folder-title">{{ t('folder.title') }}</span>
      <el-icon class="add-btn" :size="14" @click="startCreate" :title="t('folder.add')"><Plus /></el-icon>
    </div>

    <!-- Inline creator -->
    <div v-if="creating" class="folder-edit-row">
      <el-input
        v-model="newName"
        size="small"
        ref="newInputRef"
        :placeholder="t('folder.namePlaceholder')"
        @keyup.enter="commitCreate"
        @keyup.esc="cancelCreate"
        @blur="commitCreate"
        maxlength="40"
      />
    </div>

    <!-- Folder list -->
    <div
      v-for="f in folders"
      :key="f.id"
      class="folder-item"
      :class="{
        active: activeId === f.id,
        editing: editingId === f.id,
        'drag-over': dropTargetId === f.id,
      }"
      @click="onFolderClick(f)"
      @dragover.prevent="onDragOver(f, $event)"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop(f, $event)"
    >
      <!-- Edit mode: minus + input -->
      <template v-if="editingId === f.id">
        <el-icon class="minus-btn" :size="18" @click.stop="askDeleteFolder(f)" :title="t('folder.delete')"><Remove /></el-icon>
        <el-input
          v-model="editName"
          size="small"
          ref="editInputRef"
          @click.stop
          @keyup.enter="commitRename(f)"
          @keyup.esc="cancelEdit"
          @blur="commitRename(f)"
          maxlength="40"
        />
      </template>

      <!-- View mode -->
      <template v-else>
        <el-icon class="folder-icon" :size="16"><FolderOpened v-if="activeId === f.id" /><Folder v-else /></el-icon>
        <span class="folder-name" :title="f.name">{{ f.name }}</span>
        <span class="count" v-if="f.accounts?.length">{{ f.accounts.length }}</span>
        <el-icon class="edit-icon" :size="14" @click.stop="startEdit(f)" :title="t('folder.edit')"><EditPen /></el-icon>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Plus, Folder, FolderOpened, EditPen, Remove, WarningFilled } from "@element-plus/icons-vue";
import { confirm } from '@/composables/useConfirm';
import { apiFolders, apiCreateFolder, apiRenameFolder, apiDeleteFolder, apiAssignAccountToFolder } from "@/api";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const folders = ref([]);
const creating = ref(false);
const newName = ref("");
const newInputRef = ref(null);

const editingId = ref(null);
const editName = ref("");
const editInputRef = ref(null);

const dropTargetId = ref(null);

/** Active folder is whatever is in ?folder=ID on the inbox route. */
const activeId = computed(() => {
  const q = route.query.folder;
  return q ? Number(q) : null;
});

async function load() {
  try { folders.value = await apiFolders(); }
  catch { /* interceptor */ }
}

/* ---------- Create ---------- */
function startCreate() {
  cancelEdit();
  creating.value = true;
  newName.value = "";
  nextTick(() => newInputRef.value?.focus?.());
}
function cancelCreate() {
  creating.value = false;
  newName.value = "";
}
async function commitCreate() {
  const name = newName.value.trim();
  if (!creating.value) return;
  if (!name) { cancelCreate(); return; }
  try {
    await apiCreateFolder(name);
    cancelCreate();
    load();
  } catch { cancelCreate(); }
}

/* ---------- Rename ---------- */
function startEdit(f) {
  cancelCreate();
  editingId.value = f.id;
  editName.value = f.name;
  nextTick(() => editInputRef.value?.focus?.());
}
function cancelEdit() {
  editingId.value = null;
  editName.value = "";
}
async function commitRename(f) {
  if (editingId.value !== f.id) return;
  const name = editName.value.trim();
  if (!name || name === f.name) { cancelEdit(); return; }
  try {
    await apiRenameFolder(f.id, name);
    f.name = name;
  } catch { /* interceptor */ }
  cancelEdit();
}

/* ---------- Delete ---------- */
async function confirmDelete(f) {
  try {
    await apiDeleteFolder(f.id);
    ElMessage.success(t("folder.deleted"));
    if (activeId.value === f.id) router.replace({ path: "/inbox" });
    cancelEdit();
    load();
  } catch { /* interceptor */ }
}

/* ---------- Click → filter inbox ---------- */
function onFolderClick(f) {
  if (editingId.value === f.id) return; // editing — ignore card click
  // toggle: clicking the active folder again clears the filter
  if (activeId.value === f.id) {
    router.push({ path: "/inbox" });
  } else {
    router.push({ path: "/inbox", query: { folder: f.id } });
  }
}

/* ---------- Drop accounts onto folder ---------- */
function onDragOver(f, e) {
  // Only accept if the drag carries a mail-account-id (set by AccountPanel)
  const types = e.dataTransfer?.types || [];
  if (Array.from(types).includes("application/x-mail-account-id")) {
    dropTargetId.value = f.id;
    e.dataTransfer.dropEffect = "move";
  }
}
function onDragLeave() {
  dropTargetId.value = null;
}
async function onDrop(f, e) {
  dropTargetId.value = null;
  const aid = e.dataTransfer?.getData("application/x-mail-account-id");
  if (!aid) return;
  try {
    await apiAssignAccountToFolder(f.id, parseInt(aid, 10));
    ElMessage.success(t("folder.assigned", { name: f.name }));
    load();
    // Tell the rest of the app the assignment changed (so account panel
    // refreshes its folder badges, etc.).
    window.dispatchEvent(new CustomEvent("folder:changed"));
  } catch { /* interceptor */ }
}

async function askDeleteFolder(f) {
  const ok = await confirm({ title: t("folder.deleteTitle", { name: f.name }), message: t("folder.deleteHint"), confirmText: t("folder.delete"), cancelText: t("folder.cancel"), danger: true });
  if (ok) confirmDelete(f);
}
onMounted(() => {
  load();
  // Stay in sync if other tabs / events change folder state.
  window.addEventListener("folder:changed", load);
});
</script>

<style scoped>
.folder-section {
  border-top: 1px solid var(--hairline);
  margin: var(--space-sm) var(--space-xs) 0;
  padding: var(--space-sm) 0 var(--space-xs);
}
.folder-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-sm) var(--space-xs);
}
.folder-title {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--aside-text-secondary);
}
.add-btn {
  cursor: pointer;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--row-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--aside-text-secondary);
  transition: background 0.15s, color 0.15s;
}
.add-btn:hover { background: var(--brand-color); color: #fff; }

.folder-edit-row { padding: 0 10px 6px; }

.folder-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 2px 0;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--aside-text);
  font-size: var(--text-base);
  transition: background 0.12s;
  position: relative;
}
.folder-item:hover { background: var(--row-hover); }
.folder-item.active {
  background: var(--row-active);
  color: var(--row-active-text);
  font-weight: 600;
}
.folder-item.active .folder-icon { color: #fff !important; }
.folder-item.editing { background: transparent; padding: 4px 6px; }
.folder-item.drag-over {
  background: var(--row-hover);
  outline: 2px dashed var(--brand-color);
  outline-offset: -2px;
}
.folder-icon { color: var(--sf-blue); flex-shrink: 0; }
.folder-name {
  flex: 1;
  font-size: var(--text-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  font-size: 11px;
  background: rgba(128, 128, 128, 0.25);
  color: var(--aside-text-secondary);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  font-weight: 500;
}
.folder-item.active .count {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
.edit-icon {
  opacity: 0;
  transition: opacity 0.12s;
  color: var(--aside-text-secondary);
  cursor: pointer;
}
.folder-item:hover .edit-icon { opacity: 1; }
.edit-icon:hover { color: var(--brand-color); }
.minus-btn {
  cursor: pointer;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sf-red);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.minus-btn:hover { opacity: 0.8; }
</style>
