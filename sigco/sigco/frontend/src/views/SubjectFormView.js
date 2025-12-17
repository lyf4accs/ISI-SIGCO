import { teachersService } from "../services/teachersService.js";
import { subjectsService } from "../services/subjectsService.js";
import { toast } from "../components/ui.js";

export async function SubjectFormView({ mode, courseId = "", subjectId = "" }) {
  const root = document.getElementById("app");
  const teachers = await teachersService.list();

  let model = { courseId, name: "", hours: "", teacherId: "" };

  // IMPORTANT: only load subject when editing
  if (mode === "edit") {
    try {
      const s = await subjectsService.get(subjectId);
      model = {
        courseId: String(s.courseId ?? courseId),
        name: s.name ?? "",
        hours: String(s.hours ?? ""),
        teacherId: String(s.teacherId ?? "")
      };
    } catch (e) {
      toast(e.message);
      return `<div class="card"><h2>Subject not found</h2><p class="muted">${e.message}</p></div>`;
    }
  }

  const title = mode === "edit" ? "Edit subject" : "Add subject";

  const html = `
    <div class="card">
      <h2>${title}</h2>

      <div class="row">
        <div>
          <label>Course ID</label>
          <input id="courseId" value="${model.courseId}" ${courseId ? "readonly" : ""} />
        </div>
        <div>
          <label>Hours</label>
          <input id="hours" type="number" min="1" step="1" value="${model.hours}" placeholder="e.g. 3" />
        </div>
      </div>

      <div class="row">
        <div>
          <label>Subject name</label>
          <input id="name" value="${model.name}" placeholder="e.g. Descaling" />
        </div>
        <div>
          <label>Teacher</label>
          <select id="teacherId">
            <option value="">-- select --</option>
            ${teachers.map(t => `
              <option value="${t.teacherId}" ${String(t.teacherId) === String(model.teacherId) ? "selected" : ""}>
                ${t.teacherId} — ${t.firstName} ${t.lastName}
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="save">Save</button>
        <button class="secondary" id="cancel">Cancel</button>
      </div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const courseIdEl = root.querySelector("#courseId");
    const nameEl = root.querySelector("#name");
    const hoursEl = root.querySelector("#hours");
    const teacherEl = root.querySelector("#teacherId");

    root.querySelector("#cancel").onclick = () => {
      const cid = courseIdEl.value.trim();
      location.hash = cid ? `#/courses/${encodeURIComponent(cid)}` : "#/courses";
    };

    root.querySelector("#save").onclick = async () => {
      try {
        const payload = {
          courseId: Number(courseIdEl.value.trim()),
          name: nameEl.value.trim(),
          hours: Number(hoursEl.value),
          teacherId: Number(teacherEl.value)
        };

        if (!payload.courseId) throw new Error("courseId is required");
        if (!payload.name) throw new Error("name is required");
        if (!payload.hours || payload.hours <= 0) throw new Error("hours must be > 0");
        if (!payload.teacherId) throw new Error("teacherId is required");

        if (mode === "edit") {
          await subjectsService.update(subjectId, payload);
          toast("Subject updated");
        } else {
          await subjectsService.create(payload);
          toast("Subject created");
        }

        location.hash = `#/courses/${encodeURIComponent(payload.courseId)}`;
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
