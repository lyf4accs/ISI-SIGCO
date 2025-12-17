import { api } from "./apiClient.js";

export const enrollmentsService = {
  list: ({ courseId = "", residentDni = "" } = {}) => {
    const qs = new URLSearchParams();
    if (courseId !== "" && courseId != null) qs.set("courseId", courseId);
    if (residentDni) qs.set("residentDni", residentDni);
    const q = qs.toString();
    return api(`/enrollments${q ? `?${q}` : ""}`);
  },

  create: (payload) =>
    api(`/enrollments`, { method: "POST", body: JSON.stringify(payload) }),

  remove: (enrollmentId) =>
    api(`/enrollments/${encodeURIComponent(enrollmentId)}`, { method: "DELETE" }),

  // convenience
  residentCourses: (dni) =>
    api(`/residents/${encodeURIComponent(dni)}/enrolled-courses`),
  

  courseResidents: (courseId) =>
    api(`/courses/${encodeURIComponent(courseId)}/enrolled-residents`),
};
