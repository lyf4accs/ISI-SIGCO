import { api } from "./apiClient.js";

export const auditsService = {
  list: ({ status = "", auditorId = "", from = "", to = "" } = {}) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (auditorId) qs.set("auditorId", auditorId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return api(`/audits${tail}`);
  },

  get: (auditId) => api(`/audits/${encodeURIComponent(auditId)}`),
  create: (payload) => api(`/audits`, { method: "POST", body: JSON.stringify(payload) }),

  availableVisits: (auditId) => api(`/audits/${encodeURIComponent(auditId)}/available-visits`),

  assignVisits: (auditId, visitIds) =>
    api(`/audits/${encodeURIComponent(auditId)}/visits`, { method: "POST", body: JSON.stringify({ visitIds }) }),

  assignMaterials: (auditId, items) =>
    api(`/audits/${encodeURIComponent(auditId)}/materials`, { method: "POST", body: JSON.stringify({ items }) }),

  finalize: (auditId, endDate) =>
    api(`/audits/${encodeURIComponent(auditId)}/finalize`, { method: "POST", body: JSON.stringify({ endDate }) }),

  summary: (auditId) => api(`/audits/${encodeURIComponent(auditId)}/summary`)
};
