<template>
  <div class="mail-list-wrap">
    <!-- Search bar (Gmail-style: full width, prominent) -->
    <div class="search-box">
      <el-input
        v-model="search"
        :placeholder="t('list.searchPlaceholder')"
        size="default"
        clearable
        :prefix-icon="Search"
      />
    </div>

    <div class="list-toolbar">
      <el-icon v-if="showBack" class="tb-icon back-btn" :size="18" @click="$emit('back')" :title="t('reader.back')"><ArrowLeft /></el-icon>
      <el-checkbox v-model="allChecked" @change="toggleAll" />
      <el-icon class="tb-icon" :size="19" @click="$emit('sort')" :title="t('list.sort')"><Sort /></el-icon>
      <el-icon class="tb-icon" :size="19" :class="{ spin: loading }" @click="$emit('refresh')" :title="t('list.refresh')"><Refresh /></el-icon>
      <span class="spacer" />
      <span class="total">{{ t('list.total', { n: filtered.length }) }}</span>
      <el-icon class="tb-icon" :size="18" :title="t('list.grid')"><Grid /></el-icon>
    </div>

    <el-scrollbar class="rows" v-loading="loading">
      <div
        v-for="m in filtered"
        :key="m.id"
        class="row"
        :class="{ unread: m.is_unread, active: activeId === m.id }"
        @click="$emit('open', m)"
      >
        <el-checkbox :model-value="checked.has(m.id)" @change="(v) => onCheck(m.id, v)" @click.stop />
        <el-icon class="star" :class="{ starred: m.is_starred }" :size="17" @click.stop="$emit('toggle-star', m)">
          <StarFilled v-if="m.is_starred" />
          <Star v-else />
        </el-icon>
        <span class="sender" v-html="hl(extractName(m.from_addr) || t('list.unknown'))"></span>
        <span class="tag" v-if="m.account_email" :title="m.account_email" v-html="hl(shortTag(m))"></span>
        <span class="snippet">
          <span class="subject" v-if="m.subject" v-html="hl(m.subject)"></span>
          <span v-html="hl(m.snippet || '')"></span>
        </span>
        <span class="time">{{ relativeTime(m.internal_date) }}</span>
        <span v-if="m.is_unread" class="unread-dot"></span>
      </div>

      <div class="end" v-if="!filtered.length && !loading">
        {{ search ? t('list.noMatch') : t('list.noMoreData') }}
      </div>
      <div class="end" v-else-if="filtered.length">{{ t('list.noMoreData') }}</div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Sort, Refresh, Grid, Star, StarFilled, Search, ArrowLeft } from "@element-plus/icons-vue";
import { relativeTime, extractName } from "@/utils/format";

const { t } = useI18n();
const props = defineProps({
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  activeId: { type: [Number, String], default: null },
  showBack: { type: Boolean, default: false },
});
defineEmits(["open", "toggle-star", "refresh", "sort", "back"]);

const search = ref("");
const checked = ref(new Set());
const allChecked = ref(false);

/**
 * Filtered list — Gmail-style. Search runs over sender, subject, snippet,
 * and account email. Case-insensitive substring match.
 */
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.messages;
  return props.messages.filter((m) => {
    const haystack = [
      m.from_addr,
      m.subject,
      m.snippet,
      m.account_email,
      extractName(m.from_addr),
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
});

/**
 * Highlight matching substrings in yellow — like Gmail/Outlook/Yahoo.
 * Returns sanitized HTML so we can `v-html` it safely. The text itself is
 * escaped first so any `<` / `>` from the email never renders as markup.
 */
function hl(text) {
  const safe = escapeHtml(text ?? "");
  const q = search.value.trim();
  if (!q) return safe;
  const re = new RegExp(`(${escapeRegex(q)})`, "ig");
  return safe.replace(re, '<mark class="hl">$1</mark>');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function onCheck(id, v) {
  if (v) checked.value.add(id);
  else checked.value.delete(id);
  checked.value = new Set(checked.value);
  allChecked.value = filtered.value.length > 0 && checked.value.size === filtered.value.length;
}
function toggleAll(v) {
  checked.value = v ? new Set(filtered.value.map((m) => m.id)) : new Set();
}
function shortTag(m) { return (m.account_email || "").split("@")[0]; }

watch(() => props.messages, () => {
  checked.value = new Set();
  allChecked.value = false;
});
</script>

<style scoped>
.mail-list-wrap { display: flex; flex-direction: column; height: 100%; }
.search-box {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--hairline);
}
.list-toolbar {
  display: flex; align-items: center; gap: var(--space-md);
  padding: 0 var(--space-md); height: 48px;
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
.spacer { flex: 1; }
.total { font-size: var(--text-xs); color: var(--el-text-color-placeholder); font-weight: 500; }
.rows { flex: 1; }

/* --- Apple Mail message row --- */
.row {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: 0 var(--space-md); height: 56px; min-height: 58px; cursor: pointer;
  border-bottom: 1px solid var(--hairline);
  transition: background 0.1s ease;
}
.row:hover { background: var(--row-hover); }
.row.active {
  background: var(--row-active);
}
.row.active .sender,
.row.active .subject,
.row.active .snippet,
.row.active .time,
.row.active .tag {
  color: var(--row-active-text) !important;
}
/* Unread dot — sits beside the timestamp */
.star { color: var(--el-text-color-placeholder); cursor: pointer; flex-shrink: 0; }
.star.starred { color: var(--sf-yellow); }
.sender {
  width: 150px; flex-shrink: 0; font-size: var(--text-base);
  color: var(--el-text-color-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 400;
}
.row.unread .sender { font-weight: 600; }
.tag {
  flex-shrink: 0; font-size: var(--text-xs); font-weight: 500;
  color: var(--el-text-color-secondary);
  max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  background: var(--el-fill-color);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-pill);
}
.snippet {
  flex: 1; font-size: var(--text-sm); color: var(--el-text-color-placeholder);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.subject { color: var(--el-text-color-primary); margin-right: 6px; font-weight: 400; }
.row.unread .subject { font-weight: 600; }
.time {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--el-text-color-placeholder);
  min-width: 58px;
  text-align: right;
}
.unread-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--brand-color);
  flex-shrink: 0;
  margin-left: 2px;
}
.end { text-align: center; padding: 20px; font-size: var(--text-sm); color: var(--el-text-color-placeholder); }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* highlight on matching text */
:deep(mark.hl) {
  background: #ffd60a;
  color: #1d1d1f;
  border-radius: 2px;
  padding: 0 2px;
  font-weight: 600;
}
html.dark :deep(mark.hl) {
  background: #ffd60a;
  color: #1a1a1a;
  font-weight: 700;
}

/* Back button gets a touch of right spacing from the checkbox */
.back-btn { margin-right: 2px; }

/* --- Mobile: roomier rows + toolbar --- */
@media (max-width: 767px) {
  .search-box { padding: var(--space-sm); }
  .list-toolbar { height: 52px; gap: 20px; padding: 0 var(--space-sm); }
  .list-toolbar .tb-icon { font-size: 22px !important; padding: 4px; }
  .row { height: 64px; padding: 0 var(--space-sm); gap: var(--space-xs); }
  .sender { width: auto; max-width: 42%; font-size: var(--text-base); }
  .snippet { font-size: var(--text-sm); }
  .tag { display: none; }
  .time { min-width: 50px; font-size: 10px; }
  .unread-dot { width: 7px; height: 7px; }
}
</style>
