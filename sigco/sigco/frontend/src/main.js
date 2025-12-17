import { toast } from "./components/ui.js";

import { ResidentListView } from "./views/ResidentListView.js";
import { ResidentFormView } from "./views/ResidentFormView.js";
import { ResidentDetailView } from "./views/ResidentDetailView.js";

import { VisitsListView } from "./views/VisitsListView.js";
import { VisitsFormView } from "./views/VisitsFormView.js";

import { InvoiceListView } from "./views/InvoiceListView.js";
import { InvoiceCreateView } from "./views/InvoiceCreateView.js";
import { InvoiceDetailView } from "./views/InvoiceDetailView.js";

// Exercise 2 views
import { TeachersListView } from "./views/TeachersListView.js";
import { TeacherFormView } from "./views/TeacherFormView.js";
import { CoursesListView } from "./views/CoursesListView.js";
import { CoursesFormView } from "./views/CoursesFormView.js";
import { CoursesDetailView } from "./views/CoursesDetailView.js";
import { SubjectFormView } from "./views/SubjectFormView.js";
import { EnrollmentFormView } from "./views/EnrollmentFormView.js";

const app = document.getElementById("app");

function parseHash() {
  const raw = location.hash || "#/residents";
  const cleaned = raw.startsWith("#") ? raw.slice(1) : raw; // remove '#'
  const [pathPart, queryPart = ""] = cleaned.split("?");

  const parts = pathPart.split("/").filter(Boolean);
  const query = new URLSearchParams(queryPart);

  return { parts, query };
}

async function render() {
  const { parts, query } = parseHash();


  try {
    // Residents
    if (parts[0] === "residents" && parts.length === 1) {
      app.innerHTML = await ResidentListView();
      return;
    }
    if (parts[0] === "residents" && parts[1] === "new") {
      app.innerHTML = await ResidentFormView({ mode: "create" });
      return;
    }
    if (parts[0] === "residents" && parts.length === 2) {
      app.innerHTML = await ResidentDetailView({ dni: decodeURIComponent(parts[1]) });
      return;
    }

    // Visits
    if (parts[0] === "visits" && parts.length === 1) {
      app.innerHTML = await VisitsListView();
      return;
    }
    if (parts[0] === "visits" && parts[1] === "new") {
      const qp = getQuery();
      const residentDni = qp.get("residentDni") || "";
      app.innerHTML = await VisitsFormView({ residentDni });
      return;
    }

    // Invoices
    if (parts[0] === "invoices" && parts.length === 1) {
      app.innerHTML = await InvoiceListView();
      return;
    }
    if (parts[0] === "invoices" && parts[1] === "new") {
      const qp = getQuery();
      const residentDni = qp.get("residentDni") || "";
      app.innerHTML = await InvoiceCreateView({ residentDni });
      return;
    }
    if (parts[0] === "invoices" && parts.length === 2) {
      app.innerHTML = await InvoiceDetailView({ invoiceId: decodeURIComponent(parts[1]) });
      return;
    }

    // ===================== Exercise 2 =====================

    // Teachers
    if (parts[0] === "teachers" && parts.length === 1) {
      app.innerHTML = await TeachersListView();
      return;
    }
    if (parts[0] === "teachers" && parts[1] === "new") {
      app.innerHTML = await TeacherFormView({ mode: "create" });
      return;
    }
    if (parts[0] === "teachers" && parts.length === 2) {
      app.innerHTML = await TeacherFormView({ mode: "edit", teacherId: decodeURIComponent(parts[1]) });
      return;
    }

    // Courses
    if (parts[0] === "courses" && parts.length === 1) {
      app.innerHTML = await CoursesListView();
      return;
    }
    if (parts[0] === "courses" && parts[1] === "new") {
      app.innerHTML = await CoursesFormView({ mode: "create" });
      return;
    }
    if (parts[0] === "courses" && parts.length === 2) {
      app.innerHTML = await CoursesDetailView({ courseId: decodeURIComponent(parts[1]) });
      return;
    }

    // Subject create/edit (opened from course detail)
    // #/subjects/new?courseId=1
    // #/subjects/123?courseId=1   (edit)
    if (parts[0] === "subjects" && parts[1] === "new") {
      const qp = getQuery();
      const courseId = qp.get("courseId") || "";
      app.innerHTML = await SubjectFormView({ mode: "create", courseId });
      return;
    }
    if (parts[0] === "subjects" && parts.length === 2) {
      const qp = getQuery();
      const courseId = qp.get("courseId") || "";
      app.innerHTML = await SubjectFormView({ mode: "edit", subjectId: decodeURIComponent(parts[1]), courseId });
      return;
    }

    // Enrollment create (opened from course detail or resident detail)
    // #/enrollments/new?courseId=1&residentDni=123...
    if (parts[0] === "enrollments" && parts[1] === "new") {
  const courseId = query.get("courseId") || "";
  const residentDni = query.get("residentDni") || "";
  app.innerHTML = await EnrollmentFormView({ courseId, residentDni });
  return;
}


    // Default
    location.hash = "#/residents";
  } catch (e) {
    toast(e.message || "Unexpected error");
    app.innerHTML = `
      <div class="card">
        <h2>Error</h2>
        <p class="muted">${e.message || "Unexpected error"}</p>
      </div>
    `;
  }
}

window.addEventListener("hashchange", render);
window.addEventListener("load", render);
