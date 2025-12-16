import { api } from "./apiClient.js";

export const visitsService = {
  list: ({ status = "", residentDni = "", from = "", to = "" } = {}) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (residentDni) qs.set("residentDni", residentDni);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return api(`/visits?${qs.toString()}`);
  },
  get: (visitId) => api(`/visits/${encodeURIComponent(visitId)}`),
  create: (payload) => api(`/visits`, { method: "POST", body: JSON.stringify(payload) })
};
