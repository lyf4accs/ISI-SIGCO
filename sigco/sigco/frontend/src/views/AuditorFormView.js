import { auditorsService } from "../services/auditorsService.js";
import { toast } from "../components/ui.js";

export async function AuditorFormView({ mode, auditorId } = {}) {
  const isEdit = mode === "edit";
  const a = isEdit ? await auditorsService.get(auditorId) : null;

  const html = `
    <div class="card">
      <h2>${isEdit ? "Edit auditor" : "New auditor"}</h2>

      <div class="row">
        <div>
          <label>First name</label>
          <input id="firstName" value="${a?.firstName ?? ""}" />
        </div>
        <div>
          <label>Last name</label>
          <input id="lastName" value="${a?.lastName ?? ""}" />
        </div>
      </div>

      <div class="row">
        <div>
          <label>Company CIF</label>
          <input id="companyCif" value="${a?.companyCif ?? ""}" />
        </div>
        <div>
          <label>Company name</label>
          <input id="companyName" value="${a?.companyName ?? ""}" />
        </div>
      </div>

      <div class="row">
        <div>
          <label>Company address</label>
          <input id="companyAddress" value="${a?.companyAddress ?? ""}" />
        </div>
        <div>
          <label>Company phone</label>
          <input id="companyPhone" value="${a?.companyPhone ?? ""}" />
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="btnSave">Save</button>
        <button class="secondary" onclick="history.back()">Cancel</button>
      </div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");
    root.querySelector("#btnSave").onclick = async () => {
      const payload = {
        firstName: root.querySelector("#firstName").value.trim(),
        lastName: root.querySelector("#lastName").value.trim(),
        companyCif: root.querySelector("#companyCif").value.trim(),
        companyName: root.querySelector("#companyName").value.trim(),
        companyAddress: root.querySelector("#companyAddress").value.trim(),
        companyPhone: root.querySelector("#companyPhone").value.trim()
      };

      try {
        if (isEdit) await auditorsService.update(auditorId, payload);
        else await auditorsService.create(payload);
        await window.__SIGCO_RENDER__();


        toast("Saved");
        location.hash = "#/auditors";
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
