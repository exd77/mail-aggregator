<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="brand">
        <el-icon :size="40" color="#fff"><Message /></el-icon>
        <h1>Mail Aggregator</h1>
        <p>{{ t('login.subtitle') }}</p>
      </div>
      <el-form @submit.prevent="onLogin">
        <el-form-item>
          <el-input v-model="username" :placeholder="t('login.username')" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" :placeholder="t('login.password')" size="large"
            :prefix-icon="Lock" show-password @keyup.enter="onLogin" />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="onLogin">
          {{ t('login.signIn') }}
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { User, Lock, Message } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { apiLogin } from "@/api";

const { t } = useI18n();
const router = useRouter();
const username = ref("");
const password = ref("");
const loading = ref(false);

async function onLogin() {
  if (!username.value || !password.value) {
    ElMessage.warning(t("login.fillBoth"));
    return;
  }
  loading.value = true;
  try {
    const { token } = await apiLogin(username.value, password.value);
    localStorage.setItem("token", token);
    ElMessage.success(t("login.success"));
    router.replace("/");
  } catch { /* interceptor handles */ }
  finally { loading.value = false; }
}
</script>

<style scoped>
.login-wrap {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
.login-card {
  width: 360px; background: rgba(255, 255, 255, 0.95);
  border-radius: 14px; padding: 40px 32px;
  box-shadow: 0 24px 80px rgba(0,0,0,.35);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}
html.dark .login-card {
  background: rgba(44, 44, 46, 0.92);
}
.brand { text-align: center; margin-bottom: 28px; }
.brand :deep(.el-icon) {
  background: var(--brand-gradient);
  border-radius: 16px; padding: 12px;
}
.brand h1 {
  margin: 14px 0 4px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}
.brand p { margin: 0; color: var(--el-text-color-placeholder); font-size: var(--text-sm); }
</style>
