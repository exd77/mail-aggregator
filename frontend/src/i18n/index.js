import { createI18n } from "vue-i18n";
import en from "./locales/en.js";
import zh from "./locales/zh.js";
import jv from "./locales/jv.js";
import su from "./locales/su.js";
import enEP from "element-plus/es/locale/lang/en.mjs";
import zhEP from "element-plus/es/locale/lang/zh-cn.mjs";

const SUPPORTED = ["en", "zh", "jv", "su"];
const saved = localStorage.getItem("lang");
const locale = SUPPORTED.includes(saved) ? saved : "en";

const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "en",
  messages: { en, zh, jv, su },
});

export default i18n;

// Element Plus locale map — jv/su fall back to en (no EP locale for those)
export const ElLocaleMap = { en: enEP, zh: zhEP, jv: enEP, su: enEP };
