import { coursesService } from "../services/coursesService.js";
import { toast } from "../components/ui.js";

export async function CoursesFormView({ mode, courseId }) {
  const isEdit = mode === "edit";
  const c = isEdit ? await coursesService.get(courseId) : null;

  const html = `
    <div class="card">
      <h2>${isEdit ? "Edit course" : "New course"}</h2>

      <div class="row">
        <div><label>Name</label><input id="name" value="${c?.name ?? ""}" /></div>
        <div><label>Price (EUR)</label><input id="price" type="number" step="0.01" min="0" value="${c?.price ?? 0}" /></div>
        <div><label>Max residents</label><input id="maxResidents" type="number" step="1" min="1" value="${c?.maxResidents ?? 1}" /></div>
      </div>

      <div class="row">
        <div><label>Start date</label><input id="startDate" placeholder="YYYY-MM-DD" value="${c?.startDate ?? ""}" /></div>
        <div><label>End date</label><input id="endDate" placeholder="YYYY-MM-DD" value="${c?.endDate ?? ""}" /></div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="save">Save</button>
        <button class="secondary" id="cancel">Cancel</button>
      </div>

      <p class="muted" style="margin-top:12px;">After saving, open the course to add subjects and enroll residents.</p>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");
    root.querySelector("#cancel").onclick = () => (location.hash = "#/courses");

    root.querySelector("#save").onclick = async () => {
      try {
        const payload = {
          name: root.querySelector("#name").value.trim(),
          price: root.querySelector("#price").value,
          maxResidents: root.querySelector("#maxResidents").value,
          startDate: root.querySelector("#startDate").value.trim(),
          endDate: root.querySelector("#endDate").value.trim()
        };

        const saved = await coursesService.create(payload);
        toast("Course created");
        location.hash = `#/courses/${encodeURIComponent(saved.courseId)}`;
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
