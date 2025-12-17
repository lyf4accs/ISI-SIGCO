import { residentsService } from "../services/residentsService.js";
import { coursesService } from "../services/coursesService.js";
import { enrollmentsService } from "../services/enrollmentsService.js";
import { toast, qs } from "../components/ui.js";

export async function EnrollmentFormView({ courseId = "", residentDni = "" } = {}) {
  const residents = await residentsService.list({ q: "", onlyUnpaid: false });
  const courses = await coursesService.list({ q: "", from: "", to: "" });

  const today = new Date().toISOString().slice(0, 10);

  const html = `
    <div class="card">
      <h2>Enroll resident</h2>

      <div class="row">
        <div>
          <label>Course</label>
          <select id="courseId">
            <option value="">-- select --</option>
            ${courses
              .map(
                (c) =>
                  `<option value="${c.courseId}" ${
                    String(c.courseId) === String(courseId) ? "selected" : ""
                  }>${c.name} (capacity ${c.enrolledCount ?? 0}/${c.maxResidents})</option>`
              )
              .join("")}
          </select>
          <div id="cap" class="muted" style="margin-top:6px;"></div>
        </div>

        <div>
          <label>Resident</label>
          <select id="residentDni">
            <option value="">-- select --</option>
            ${residents
              .map(
                (r) =>
                  `<option value="${r.dni}" ${
                    String(r.dni) === String(residentDni) ? "selected" : ""
                  }>${r.dni} — ${r.firstName} ${r.lastName}</option>`
              )
              .join("")}
          </select>
        </div>

        <div>
          <label>Enrollment date</label>
          <input id="enrollmentDate" value="${today}" />
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="save" disabled>Enroll</button>
        <button class="secondary" id="cancel">Cancel</button>
      </div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");
    const courseSel = qs("#courseId", root);
    const residentSel = qs("#residentDni", root);
    const dateInput = qs("#enrollmentDate", root);
    const capEl = qs("#cap", root);
    const btnSave = qs("#save", root);
    const btnCancel = qs("#cancel", root);

    if (!courseSel || !residentSel || !dateInput || !capEl || !btnSave || !btnCancel) {
      console.error("EnrollmentFormView missing elements", {
        courseSel,
        residentSel,
        dateInput,
        capEl,
        btnSave,
        btnCancel,
      });
      return;
    }

    btnCancel.onclick = () => {
      // go back to a sensible place
      if (residentDni) location.hash = `#/residents/${encodeURIComponent(residentDni)}`;
      else if (courseId) location.hash = `#/courses/${encodeURIComponent(courseId)}`;
      else location.hash = "#/courses";
    };

    async function refreshCapacityAndButton() {
      const cid = courseSel.value;
      const rdni = residentSel.value;

      btnSave.disabled = true;
      capEl.textContent = "";

      if (!cid) {
        capEl.textContent = "Select a course.";
        return;
      }

      try {
        const s = await coursesService.summary(cid);
        capEl.textContent = `Capacity: ${s.enrolledCount}/${courses.find(x => String(x.courseId)===String(cid))?.maxResidents ?? "?"} · Duration: ${s.durationHours}h`;

        if (!s.hasCapacity) {
          capEl.textContent += " · Course is FULL";
          btnSave.disabled = true;
          return;
        }
      } catch (e) {
        capEl.textContent = "Could not load course summary.";
        btnSave.disabled = true;
        return;
      }

      // enable only if both selected
      btnSave.disabled = !cid || !rdni;
    }

    courseSel.addEventListener("change", refreshCapacityAndButton);
    residentSel.addEventListener("change", refreshCapacityAndButton);

    btnSave.onclick = async () => {
      try {
        const payload = {
          residentDni: residentSel.value,
          courseId: Number(courseSel.value), // backend accepts string too, but this keeps it clean
          enrollmentDate: dateInput.value.trim(),
        };

        await enrollmentsService.create(payload);
        toast("Enrollment created");

        // after save, go back so user sees it immediately
        if (payload.residentDni) {
          location.hash = `#/residents/${encodeURIComponent(payload.residentDni)}`;
        } else {
          location.hash = `#/courses/${encodeURIComponent(payload.courseId)}`;
        }
      } catch (e) {
        toast(e.message || "Could not enroll");
        console.error(e);
      }
    };

    refreshCapacityAndButton();
  }
}
