import { residentsService } from "../services/residentsService.js";
import { invoicesService } from "../services/invoicesService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function InvoiceCreateView({ residentDni = "" }) {
  const residents = await residentsService.list({ q: "", onlyUnpaid: false });
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    <div class="card">
      <h2>Create invoice</h2>

      <div class="row">
        <div>
          <label>Resident</label>
          <select id="residentDni">
            <option value="">-- select --</option>
            ${residents
              .map(
                (r) =>
                  `<option value="${r.dni}" ${
                    r.dni === residentDni ? "selected" : ""
                  }>${r.dni} — ${r.firstName} ${r.lastName}</option>`
              )
              .join("")}
          </select>
        </div>
        <div>
          <label>Creation date</label>
          <input id="creationDate" value="${today}" />
        </div>
      </div>

      <div class="card" style="background:#f9fafb; margin-top:12px;">
        <strong>Live preview</strong>
        <div id="preview" class="muted" style="margin-top:8px;">Select a resident to load unpaid visits.</div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="create" disabled>Create invoice</button>
        <button class="secondary" id="cancel">Cancel</button>
      </div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");

    const residentSel = root.querySelector("#residentDni");
    const creationDateEl = root.querySelector("#creationDate");
    const btnCreate = root.querySelector("#create");
    const btnCancel = root.querySelector("#cancel");
    const preview = root.querySelector("#preview");

    if (!residentSel || !creationDateEl || !btnCreate || !btnCancel || !preview) {
      console.error("InvoiceCreateView missing elements:", {
        residentSel,
        creationDateEl,
        btnCreate,
        btnCancel,
        preview
      });
      return;
    }

    btnCancel.onclick = () => (location.hash = "#/invoices");

    async function refreshPreview() {
      const dni = residentSel.value;
      if (!dni) {
        preview.textContent = "Select a resident to load unpaid visits.";
        btnCreate.disabled = true;
        return;
      }

      try {
        const data = await residentsService.unpaid(dni);

        if (data.unpaidVisitsCount === 0) {
          preview.innerHTML = `<div>This resident has no pending visits to invoice.</div>`;
          btnCreate.disabled = true;
          return;
        }

        preview.innerHTML = `
          <div class="muted">${data.unpaidVisitsCount} unpaid visit(s)</div>
          <table style="margin-top:10px;">
            <thead><tr><th>Date</th><th>ManagerId</th><th>Amount</th><th>Description</th></tr></thead>
            <tbody>
              ${data.unpaidVisits
                .map(
                  (v) => `
                <tr>
                  <td>${v.visitDate}</td>
                  <td>${v.managerId}</td>
                  <td>${moneyEUR(v.amount)}</td>
                  <td>${v.description}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div style="margin-top:10px;"><strong>Total: ${moneyEUR(
            data.unpaidVisitsTotal
          )}</strong></div>
        `;

        btnCreate.disabled = false;
      } catch (e) {
        toast(e.message);
        btnCreate.disabled = true;
      }
    }

    residentSel.addEventListener("change", refreshPreview);

    btnCreate.onclick = async () => {
      try {
        const payload = {
          residentDni: residentSel.value,
          creationDate: creationDateEl.value.trim()
        };
        const inv = await invoicesService.create(payload);
        toast("Invoice created (visits settled)");
        location.hash = `#/invoices/${encodeURIComponent(inv.invoiceId)}`;
      } catch (e) {
        toast(e.message);
      }
    };

    refreshPreview();
  }
}
