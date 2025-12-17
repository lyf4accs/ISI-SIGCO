import { api } from "./apiClient.js";

export const teachersService = {
  list: ({ q = "" } = {}) => api(`/teachers?q=${encodeURIComponent(q)}`),
  get: (teacherId) => api(`/teachers/${encodeURIComponent(teacherId)}`),
  create: (payload) => api("/teachers", { method: "POST", body: JSON.stringify(payload) }),
  update: (teacherId, payload) => api(`/teachers/${encodeURIComponent(teacherId)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (teacherId) => api(`/teachers/${encodeURIComponent(teacherId)}`, { method: "DELETE" })
};
