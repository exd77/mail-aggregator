<template>
  <div class="reader-page light-zone" v-loading="loading">
    <!-- Toolbar -->
    <div class="reader-toolbar">
      <el-button :icon="ArrowLeft" text @click="$emit('back')">{{ t('reader.back') }}</el-button>
      <span class="spacer" />
      <el-icon class="star" :class="{ starred: detail?.is_starred }" :size="20"
        @click="detail && $emit('toggle-star', detail)">
        <StarFilled v-if="detail?.is_starred" />
        <Star v-else />
      </el-icon>
    </div>

    <!-- Body -->
    <el-scrollbar class="reader-scroll" v-if="detail">
      <!-- Subject + meta: stay full-width, left-aligned (like Gmail). -->
      <div class="reader-head">
        <h1 class="subject">{{ detail.subject || t('reader.noSubject') }}</h1>

        <div class="meta">
          <div class="meta-row">
            <span class="k">{{ t('reader.from') }}</span>
            <span class="v">{{ detail.from_addr }}</span>
          </div>
          <div class="meta-row">
            <span class="k">{{ t('reader.to') }}</span>
            <span class="v">{{ detail.to_addr }}</span>
          </div>
          <div class="meta-row">
            <span class="k">{{ t('reader.account') }}</span>
            <span class="v"><span class="acct-tag">{{ detail.account_email }}</span></span>
          </div>
          <div class="meta-row">
            <span class="k">{{ t('reader.date') }}</span>
            <span class="v">{{ dateStr }}</span>
          </div>
        </div>

        <div class="divider" />
      </div>

      <!-- Body: centered column, like Gmail. -->
      <div class="reader-body">
        <div v-if="detail.body_html" class="mail-body" v-html="sanitizeHtml(detail.body_html)" />
        <pre v-else-if="detail.body_text" class="mail-text">{{ detail.body_text }}</pre>
        <div v-else class="mail-text">{{ detail.snippet }}</div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowLeft, Star, StarFilled } from "@element-plus/icons-vue";
import { sanitizeHtml } from "@/utils/format";

const { t } = useI18n();
const props = defineProps({
  detail: { type: Object, default: null },
  loading: { type: Boolean, default: false },
});
defineEmits(["back", "toggle-star"]);

const dateStr = computed(() =>
  props.detail?.internal_date ? new Date(props.detail.internal_date).toLocaleString() : ""
);
</script>

<style scoped>
/*
 * The reader is intentionally locked to a LIGHT palette regardless of
 * the global theme. Many emails ship inline styles that assume a white
 * background (black text, dark headings, light-grey rules). Rendering
 * them on a dark canvas can hide content. We isolate the reader with
 * its own variables so EP dark mode doesn't bleed in.
 */
.light-zone {
  --el-bg-color: #ffffff;
  --el-bg-color-overlay: #ffffff;
  --el-text-color-primary: #1d1d1f;
  --el-text-color-regular: #3a3a3c;
  --el-text-color-placeholder: #86909c;
  --el-border-color: #e5e6eb;
  --el-border-color-lighter: #f2f3f5;
  --el-fill-color: #f7f8fa;

  background: #ffffff;
  color: #1d1d1f;
}
.reader-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.reader-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  height: 44px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.09);
  background: #ffffff;
  flex-shrink: 0;
}
.spacer { flex: 1; }
.star { color: #c9cdd4; cursor: pointer; }
.star.starred { color: var(--sf-yellow, #ff9500); }
.reader-scroll { flex: 1; background: #ffffff; }
.reader-head {
  padding: 28px 32px 0;
  color: #1d1d1f;
}
.reader-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 32px 60px;
}
.subject {
  margin: 0 0 18px;
  font-size: 22px;
  font-weight: 700;
  color: #1d1d1f;
  word-break: break-word;
  letter-spacing: -0.02em;
}
.meta { padding: 8px 0; }
.meta-row {
  display: flex;
  gap: 12px;
  font-size: var(--text-sm);
  margin: 6px 0;
  color: #1d1d1f;
}
.meta-row .k { width: 70px; flex-shrink: 0; color: #86909c; font-weight: 500; }
.meta-row .v {
  color: #3a3a3c;
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;   /* break long addresses but keep words intact */
  word-break: normal;
}
.acct-tag {
  background: #e8f3ff;
  color: #007aff;
  border: 1px solid #cce6ff;
  padding: 1px 8px;
  border-radius: var(--radius-control, 6px);
  font-size: var(--text-xs);
  font-weight: 500;
}
.divider {
  height: 1px;
  background: #e5e6eb;
  margin: 18px 0;
}
.mail-text {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 15px;
  color: #1d1d1f;
  line-height: 1.65;
}
.mail-body {
  font-size: 15px;
  line-height: 1.65;
  color: #1d1d1f;
  word-break: break-word;
}
.mail-body :deep(img) { max-width: 100%; height: auto; }
.mail-body :deep(a) { color: #007aff; }
.mail-body :deep(*) { background-color: transparent; }
.mail-body :deep(p),
.mail-body :deep(div),
.mail-body :deep(span),
.mail-body :deep(li),
.mail-body :deep(td) {
  color: inherit;
}

/* --- Mobile: tighter padding, bigger touch target on back --- */
@media (max-width: 767px) {
  .reader-toolbar { height: 48px; padding: 0 12px; }
  .reader-head { padding: 18px 16px 0; }
  .reader-body { padding: 8px 16px 48px; }
  .subject { font-size: 19px; }
  .meta-row .k { width: 56px; }
}
</style>
