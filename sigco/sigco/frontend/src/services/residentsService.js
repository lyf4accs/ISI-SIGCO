import { api } from "./apiClient.js";

export const residentsService = {
  list: ({ q = "", onlyUnpaid = false } = {}) =>
    api(`/residents?q=${encodeURIComponent(q)}&onlyUnpaid=${onlyUnpaid}`),
  get: (dni) => api(`/residents/${encodeURIComponent(dni)}`),
  create: (payload) => api(`/residents`, { method: "POST", body: JSON.stringify(payload) }),
  update: (dni, payload) => api(`/residents/${encodeURIComponent(dni)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (dni) => api(`/residents/${encodeURIComponent(dni)}`, { method: "DELETE" }),
  unpaid: (dni) => api(`/residents/${encodeURIComponent(dni)}/unpaid-visits`),
  async enrolledCourses(dni) {
  return api(`/residents/${encodeURIComponent(dni)}/enrolled-courses`);
},

};
