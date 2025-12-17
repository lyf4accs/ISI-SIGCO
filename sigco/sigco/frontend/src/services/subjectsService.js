import { api } from "./apiClient.js";

export const subjectsService = {
  list: ({ courseId } = {}) => api(`/subjects?courseId=${encodeURIComponent(courseId ?? "")}`),
  get: (subjectId) => api(`/subjects/${encodeURIComponent(subjectId)}`),
  create: (payload) => api("/subjects", { method: "POST", body: JSON.stringify(payload) }),
  update: (subjectId, payload) => api(`/subjects/${encodeURIComponent(subjectId)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (subjectId) => api(`/subjects/${encodeURIComponent(subjectId)}`, { method: "DELETE" })
};
