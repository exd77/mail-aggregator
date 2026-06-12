<template>
  <el-config-provider :locale="epLocale">
    <router-view />
    <MacConfirm />
  </el-config-provider>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { ElConfigProvider } from "element-plus";
import { ElLocaleMap } from "./i18n";
import { unlockAudio } from "@/utils/sound";
import MacConfirm from "@/components/MacConfirm.vue";

const { locale } = useI18n();
const epLocale = computed(() => ElLocaleMap[locale.value] ?? ElLocaleMap.en);

onMounted(() => unlockAudio());
</script>
