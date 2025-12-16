import { residentsService } from "../services/residentsService.js";
import { managersService } from "../services/managersService.js";
import { visitsService } from "../services/visitsService.js";
import { toast } from "../components/ui.js";

export async function VisitsFormView({ residentDni = "" }) {
  const residents = await residentsService.list({ q: "", onlyUnpaid: false });
  const managers = await managersService.list();
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    <div class="card">
      <h2>New visit</h2>
      <div class="row">
        <div>
          <label>Resident</label>
          <select id="residentDni">
            <option value="">-- select --</option>
            ${residents
              .map(
                (r) =>
                  `<option value="${r.dni}" ${r.dni === residentDni ? "selected" : ""}>${r.dni} — ${r.firstName} ${r.lastName}</option>`
              )
              .join("")}
          </select>
        </div>
        <div>
          <label>Visit date</label>
          <input id="visitDate" value="${today}" />
        </div>
        <div>
          <label>Manager</label>
          <select id="managerId">
            <option value="">-- select --</option>
            ${managers.map((m) => `<option value="${m.managerId}">${m.name}</option>`).join("")}
          </select>
          <div class="muted" style="margin-top:6px;">
          
          </div>
        </div>
        <div>
          <label>Amount (EUR)</label>
          <input id="amount" type="number" step="0.01" min="0" placeholder="e.g. 80.00" />
        </div>
      </div>

      <div>
        <label>Description</label>
        <textarea id="description" placeholder="Describe the issue and work done..."></textarea>
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

    const cancel = root.querySelector("#cancel");
    const save = root.querySelector("#save");

    const residentEl = root.querySelector("#residentDni");
    const dateEl = root.querySelector("#visitDate");
    const managerEl = root.querySelector("#managerId");
    const amountEl = root.querySelector("#amount");
    const descEl = root.querySelector("#description");

    if (cancel) cancel.onclick = () => (location.hash = "#/visits");

    if (!save || !residentEl || !dateEl || !managerEl || !amountEl || !descEl) {
      console.error("VisitsFormView missing elements");
      return;
    }

    save.onclick = async () => {
      try {
        const payload = {
          residentDni: residentEl.value,
          visitDate: dateEl.value.trim(),
          managerId: managerEl.value,
          amount: amountEl.value,
          description: descEl.value.trim()
        };

        await visitsService.create(payload);
        toast("Visit created (UNPAID)");
        location.hash = residentDni ? `#/residents/${encodeURIComponent(residentDni)}` : "#/visits";
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
