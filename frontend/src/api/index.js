import http from "@/axios";

export const apiLogin = (username, password) => http.post("/auth/login", { username, password });
export const apiChangePassword = (currentPassword, newPassword) =>
  http.post("/auth/change-password", { currentPassword, newPassword });

// Import a previously-exported backup (merge, non-destructive).
export const apiImportBackup = (backup) => http.post("/backup/import", backup);

/**
 * Export the account/folder backup as a file download. The export endpoint
 * streams a raw JSON attachment (not the {code,data} envelope), so we fetch
 * it directly with the auth token and trigger a browser download instead of
 * going through the axios response interceptor.
 */
export async function downloadBackup() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/backup/export", {
    headers: token ? { Authorization: token } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : "mail-aggregator-backup.json";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export const apiAccounts = () => http.get("/accounts");
export const apiDeleteAccount = (id) => http.delete(`/accounts/${id}`);
export const apiReorderAccounts = (ids) => http.post("/accounts/reorder", { ids });
export const apiSetAccountLabel = (id, label) => http.put(`/accounts/${id}/label`, { label });
export const apiSyncAccount = (id, maxResults = 25) => http.post(`/accounts/${id}/sync`, { maxResults });
export const apiSyncAll = (maxResults = 25) => http.post("/sync", { maxResults });

export const apiOAuthStart = () => http.post("/oauth/google/start");
export const apiOAuthStatus = (state) => http.get("/oauth/google/status", { params: { state } });
export const apiOAuthSubmit = (state, code) => http.post("/oauth/google/submit", { state, code });

export const apiImapDetect = (email) => http.post("/imap/detect", { email });
export const apiImapConnect = (data) => http.post("/imap/connect", data);

export const apiInbox = (params = {}) => http.get("/inbox", { params });
export const apiMail = (id) => http.get(`/mail/${id}`);
export const apiStarred = (params = {}) => http.get("/starred", { params });
export const apiToggleStar = (id, value) => http.post(`/mail/${id}/star`, value === undefined ? {} : { value });

// Folders (sidebar categories)
export const apiFolders = () => http.get("/folders");
export const apiCreateFolder = (name) => http.post("/folders", { name });
export const apiRenameFolder = (id, name) => http.put(`/folders/${id}`, { name });
export const apiDeleteFolder = (id) => http.delete(`/folders/${id}`);
export const apiAssignAccountToFolder = (folderId, accountId) =>
  http.put(`/folders/${folderId ?? 0}/accounts/${accountId}`);
