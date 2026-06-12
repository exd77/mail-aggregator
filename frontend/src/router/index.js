import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/login", component: () => import("@/views/Login.vue") },
  {
    path: "/",
    component: () => import("@/layout/Layout.vue"),
    redirect: "/inbox",
    children: [
      { path: "inbox", name: "inbox", component: () => import("@/views/Inbox.vue") },
      { path: "starred", name: "starred", component: () => import("@/views/Starred.vue") },
      { path: "settings", name: "settings", component: () => import("@/views/Settings.vue") },
      { path: "accounts", name: "accounts", component: () => import("@/views/Accounts.vue") },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");
  if (to.path !== "/login" && !token) return next("/login");
  if (to.path === "/login" && token) return next("/");
  next();
});

export default router;
