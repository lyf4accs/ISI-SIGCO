import { api } from "./apiClient.js";

export const invoicesService = {
  list: ({ residentDni = "", from = "", to = "" } = {}) => {
    const qs = new URLSearchParams();
    if (residentDni) qs.set("residentDni", residentDni);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return api(`/invoices?${qs.toString()}`);
  },
  get: (invoiceId) => api(`/invoices/${encodeURIComponent(invoiceId)}`),
  create: (payload) => api(`/invoices`, { method: "POST", body: JSON.stringify(payload) })
};
