import { api } from "./apiClient.js";

export const coursesService = {
  list: ({ q = "", from = "", to = "" } = {}) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return api(`/courses${tail}`);
  },
  get: (courseId) => api(`/courses/${encodeURIComponent(courseId)}`),
  create: (payload) => api("/courses", { method: "POST", body: JSON.stringify(payload) }),
  update: (courseId, payload) => api(`/courses/${encodeURIComponent(courseId)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (courseId) => api(`/courses/${encodeURIComponent(courseId)}`, { method: "DELETE" }),

  summary: (courseId) => api(`/courses/${encodeURIComponent(courseId)}/summary`),
  enrolledResidents: (courseId) => api(`/courses/${encodeURIComponent(courseId)}/enrolled-residents`)
};
