import { api } from "./apiClient.js";

export const auditorsService = {
  list: ({ q = "" } = {}) => api(`/auditors?q=${encodeURIComponent(q)}`),
  get: (auditorId) => api(`/auditors/${encodeURIComponent(auditorId)}`),
  create: (payload) => api(`/auditors`, { method: "POST", body: JSON.stringify(payload) }),
  update: (auditorId, payload) => api(`/auditors/${encodeURIComponent(auditorId)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (auditorId) => api(`/auditors/${encodeURIComponent(auditorId)}`, { method: "DELETE" })
};
