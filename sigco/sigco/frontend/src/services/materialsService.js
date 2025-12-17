import { api } from "./apiClient.js";

export const materialsService = {
  list: ({ q = "" } = {}) => api(`/materials?q=${encodeURIComponent(q)}`),
  get: (materialId) => api(`/materials/${encodeURIComponent(materialId)}`),
  create: (payload) => api(`/materials`, { method: "POST", body: JSON.stringify(payload) }),
  update: (materialId, payload) => api(`/materials/${encodeURIComponent(materialId)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (materialId) => api(`/materials/${encodeURIComponent(materialId)}`, { method: "DELETE" })
};
