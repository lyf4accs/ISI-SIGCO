import { teachersService } from "../services/teachersService.js";
import { toast } from "../components/ui.js";

export async function TeacherFormView({ mode, teacherId }) {
  const isEdit = mode === "edit";
  const t = isEdit ? await teachersService.get(teacherId) : null;

  const html = `
    <div class="card">
      <h2>${isEdit ? "Edit teacher" : "New teacher"}</h2>

      <div class="row">
        <div><label>First name</label><input id="firstName" value="${t?.firstName ?? ""}" /></div>
        <div><label>Last name(s)</label><input id="lastName" value="${t?.lastName ?? ""}" /></div>
        <div><label>Phone</label><input id="phone" value="${t?.phone ?? ""}" /></div>
        <div><label>Salary</label><input id="salary" type="number" step="0.01" min="0" value="${t?.salary ?? ""}" /></div>
      </div>

      <div class="row">
        <div><label>Address</label><input id="address" value="${t?.address ?? ""}" /></div>
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
    const root = document.getElementById("app");
    root.querySelector("#cancel").onclick = () => (location.hash = "#/teachers");

    root.querySelector("#save").onclick = async () => {
      try {
        const payload = {
          firstName: root.querySelector("#firstName").value.trim(),
          lastName: root.querySelector("#lastName").value.trim(),
          address: root.querySelector("#address").value.trim(),
          phone: root.querySelector("#phone").value.trim(),
          salary: root.querySelector("#salary").value
        };

        if (isEdit) {
          await teachersService.update(teacherId, payload);
          toast("Teacher updated");
        } else {
          await teachersService.create(payload);
          toast("Teacher created");
        }
        location.hash = "#/teachers";
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
