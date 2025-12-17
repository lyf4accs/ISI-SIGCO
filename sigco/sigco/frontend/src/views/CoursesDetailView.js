import { coursesService } from "../services/coursesService.js";
import { subjectsService } from "../services/subjectsService.js";
import { residentsService } from "../services/residentsService.js";
import { toast, moneyEUR } from "../components/ui.js";

export async function CoursesDetailView({ courseId }) {
  // Load initial data
  const c = await coursesService.get(courseId);
  const summary = await coursesService.summary(courseId);
  const subjects = await subjectsService.list({ courseId });
  const enrolled = await coursesService.enrolledResidents(courseId);

  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>${c.name}</h2>
          <p class="muted">
            Dates: <strong>${c.startDate}</strong> → <strong>${c.endDate}</strong> ·
            Price: <strong>${moneyEUR(c.price)}</strong>
          </p>
          <p class="muted">
            Duration: <strong>${summary.durationHours}h</strong> ·
            Enrolled: <strong>${summary.enrolledCount}/${c.maxResidents}</strong> ·
            Capacity: <strong>${summary.hasCapacity ? "Available" : "FULL"}</strong>
          </p>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; align-items:flex-end;">
          <button class="secondary" id="btnAddSubject">Add subject</button>
          <button id="btnEnroll" ${summary.hasCapacity ? "" : "disabled"}>Enroll resident</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Subjects</h3>
      <div id="subjectsWrap"></div>
    </div>

    <div class="card">
      <h3>Enrolled residents</h3>
      <div id="enrolledWrap"></div>
    </div>

    <div class="card">
      <button class="secondary" id="back">Back to courses</button>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");
    const subjectsWrap = root.querySelector("#subjectsWrap");
    const enrolledWrap = root.querySelector("#enrolledWrap");

    root.querySelector("#back").onclick = () => (location.hash = "#/courses");
    root.querySelector("#btnAddSubject").onclick = () => (location.hash = `#/subjects/new?courseId=${encodeURIComponent(courseId)}`);
    root.querySelector("#btnEnroll").onclick = () => (location.hash = `#/enrollments/new?courseId=${encodeURIComponent(courseId)}`);

    // Subjects table
    subjectsWrap.innerHTML = subjects.length === 0
      ? `<p class="muted">No subjects yet. Add at least one.</p>`
      : `
        <table>
          <thead><tr><th>Name</th><th>Hours</th><th>TeacherId</th><th></th></tr></thead>
          <tbody>
            ${subjects.map(s => `
              <tr>
                <td>${s.name}</td>
                <td>${s.hours}</td>
                <td>${s.teacherId}</td>
                <td style="display:flex; gap:8px; justify-content:flex-end;">
                  <button class="secondary" data-edit="${s.subjectId}">Edit</button>
                  <button data-del="${s.subjectId}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

    subjectsWrap.querySelectorAll("[data-edit]").forEach(b => {
      b.onclick = () => (location.hash = `#/subjects/${encodeURIComponent(b.dataset.edit)}?courseId=${encodeURIComponent(courseId)}`);
    });

    subjectsWrap.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = async () => {
        if (!confirm("Delete subject?")) return;
        try {
          await subjectsService.remove(b.dataset.del);
          toast("Subject deleted");
          location.hash = `#/courses/${encodeURIComponent(courseId)}`; // reload
        } catch (e) {
          toast(e.message);
        }
      };
    });

    // Enrolled residents table
    enrolledWrap.innerHTML = enrolled.length === 0
      ? `<p class="muted">No enrollments yet.</p>`
      : `
        <table>
          <thead><tr><th>DNI</th><th>Name</th><th>City</th><th>Enrollment date</th></tr></thead>
          <tbody>
            ${enrolled.map(r => `
              <tr data-dni="${r.dni}" style="cursor:pointer">
                <td>${r.dni}</td>
                <td>${r.firstName} ${r.lastName}</td>
                <td>${r.city}</td>
                <td>${r.enrollmentDate}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p class="muted" style="margin-top:8px;">Tip: click a resident row to open resident detail.</p>
      `;

    enrolledWrap.querySelectorAll("tr[data-dni]").forEach(tr => {
      tr.onclick = () => (location.hash = `#/residents/${encodeURIComponent(tr.dataset.dni)}`);
    });
  }
}
