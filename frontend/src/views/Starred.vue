<template>
  <div class="page">
    <!-- Reading mode: full-width inline reader -->
    <MailReader
      v-if="readerOpen"
      :detail="detail"
      :loading="detailLoading"
      @back="closeReader"
      @toggle-star="toggleStar"
    />

    <!-- Empty state -->
    <div v-else-if="!messages.length && !loading" class="empty">
      <el-icon :size="44"><Star /></el-icon>
      <p>{{ t('starred.emptyTitle') }}</p>
      <span class="hint">{{ t('starred.emptyHint') }}</span>
    </div>

    <!-- List -->
    <MailList
      v-else
      :messages="messages"
      :loading="loading"
      :active-id="selected?.id"
      @open="open"
      @toggle-star="toggleStar"
      @refresh="load"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { Star } from "@element-plus/icons-vue";
import { apiStarred, apiMail, apiToggleStar } from "@/api";
import MailList from "@/components/MailList.vue";
import MailReader from "@/components/MailReader.vue";

const { t } = useI18n();
const messages = ref([]);
const loading = ref(false);
const selected = ref(null);
const detail = ref(null);
const detailLoading = ref(false);
const readerOpen = ref(false);

async function load() {
  loading.value = true;
  try { messages.value = await apiStarred({ limit: 200 }); }
  finally { loading.value = false; }
}
async function open(m) {
  selected.value = m; readerOpen.value = true; detailLoading.value = true;
  try { detail.value = await apiMail(m.id); m.is_unread = 0; }
  finally { detailLoading.value = false; }
}
function closeReader() {
  readerOpen.value = false;
  selected.value = null;
  detail.value = null;
  // Refresh in case the user un-starred this email while reading
  load();
}
async function toggleStar(m) {
  try {
    const r = await apiToggleStar(m.id);
    if (detail.value?.id === m.id) detail.value.is_starred = r.is_starred;
    if (!r.is_starred) {
      messages.value = messages.value.filter((x) => x.id !== m.id);
    } else {
      const row = messages.value.find((x) => x.id === m.id);
      if (row) row.is_starred = r.is_starred;
    }
  } catch { /* interceptor */ }
}
onMounted(load);
</script>

<style scoped>
.page { height: 100%; }
.empty {
  height: 100%; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; color: var(--el-text-color-placeholder);
  text-align: center; padding: 0 24px;
}
.empty p { margin: 0; font-size: 15px; color: var(--el-text-color-regular); }
.hint { max-width: 420px; font-size: var(--text-sm); }
</style>
