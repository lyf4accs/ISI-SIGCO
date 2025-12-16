import { api } from "./apiClient.js";

export const managersService = {
  list: () => api(`/managers`),
  create: (payload) => api(`/managers`, { method: "POST", body: JSON.stringify(payload) })
};
