import { auditorsService } from "../services/auditorsService.js";
import { auditsService } from "../services/auditsService.js";
import { toast } from "../components/ui.js";

export async function AuditCreateView() {
  const auditors = await auditorsService.list({ q: "" });
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    <div class="card">
      <h2>Create audit</h2>

      <div class="row">
        <div>
          <label>Creation date</label>
          <input id="creationDate" type="date" value="${today}" />
        </div>
        <div>
          <label>Auditor</label>
          <select id="auditorId">
            <option value="">Select auditor...</option>
            ${auditors.map(a => `<option value="${a.auditorId}">${a.companyName} (${a.companyCif})</option>`).join("")}
          </select>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="btnCreate">Create</button>
        <button class="secondary" onclick="history.back()">Cancel</button>
      </div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");
    root.querySelector("#btnCreate").onclick = async () => {
      const payload = {
        creationDate: root.querySelector("#creationDate").value,
        auditorId: Number(root.querySelector("#auditorId").value)
      };

      try {
        const created = await auditsService.create(payload);
        toast("Audit created");
        location.hash = `#/audits/${encodeURIComponent(created.auditId)}`;
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
