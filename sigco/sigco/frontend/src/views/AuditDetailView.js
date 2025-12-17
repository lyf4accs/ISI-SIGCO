import { auditsService } from "../services/auditsService.js";
import { materialsService } from "../services/materialsService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function AuditDetailView({ auditId }) {
  const audit = await auditsService.get(auditId);
  const isOpen = audit.status === "OPEN";

  const allMaterials = await materialsService.list({ q: "" });
  const availableVisits = isOpen ? await auditsService.availableVisits(auditId) : [];

  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Audit #${audit.auditId}</h2>
          <p class="muted">
            Status: <strong>${audit.status}</strong> ·
            Creation: <strong>${audit.creationDate}</strong> ·
            End: <strong>${audit.endDate ?? "-"}</strong>
          </p>
          <p class="muted">
            Auditor: <strong>${audit.auditor?.companyName ?? ""}</strong> (${audit.auditor?.companyCif ?? ""})
            · ${audit.auditor?.companyPhone ?? ""}
          </p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end;">
          <div style="text-align:right">
            <div class="muted">Visits total</div>
            <div style="font-size:18px;"><strong>${moneyEUR(audit.auditedVisitsTotalAmount)}</strong></div>
            <div class="muted" style="margin-top:6px;">Salary (20%)</div>
            <div style="font-size:18px;"><strong>${moneyEUR(audit.auditorSalaryAmount)}</strong></div>
          </div>
        </div>
      </div>

      ${!isOpen ? `<div class="card" style="background:#f9fafb"><strong>Audit finalized; assignments are locked.</strong></div>` : ""}
    </div>

    <div class="card">
      <div class="row">
        <div>
          <h3>Assigned visits</h3>
          <p class="muted">Only visits with visitDate ≤ creationDate can be assigned.</p>
        </div>
      </div>

      ${audit.visits.length === 0 ? `<p class="muted">No visits assigned yet.</p>` : `
        <table>
          <thead><tr><th>Date</th><th>Resident</th><th>ManagerId</th><th>Amount</th><th>Status</th><th>Description</th></tr></thead>
          <tbody>
            ${audit.visits.map(v => `
              <tr>
                <td>${v.visitDate}</td>
                <td>${v.residentDni}</td>
                <td>${v.managerId}</td>
                <td>${moneyEUR(v.amount)}</td>
                <td>${v.status}</td>
                <td>${v.description}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `}

      ${isOpen ? `
        <hr style="border:none;border-top:1px solid #eee;margin:14px 0;" />
        <h4>Add visits</h4>
        ${availableVisits.length === 0 ? `<p class="muted">No eligible visits available.</p>` : `
          <div style="max-height:220px; overflow:auto; border:1px solid #eee; border-radius:10px; padding:10px;">
            ${availableVisits.map(v => `
              <label style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
                <input type="checkbox" class="chkVisit" value="${v.visitId}" />
                <span>
                  <strong>#${v.visitId}</strong> · ${v.visitDate} · ${v.residentDni} · ${moneyEUR(v.amount)}
                  <span class="muted"> · ${v.description}</span>
                </span>
              </label>
            `).join("")}
          </div>
          <div style="display:flex; gap:10px; margin-top:10px;">
            <button id="btnAssignVisits">Assign selected visits</button>
          </div>
        `}
      ` : ""}
    </div>

    <div class="card">
      <div class="row">
        <div>
          <h3>Required materials</h3>
          <p class="muted">Materials can be assigned only while audit is OPEN.</p>
        </div>
      </div>

      ${audit.materials.length === 0 ? `<p class="muted">No materials assigned.</p>` : `
        <table>
          <thead><tr><th>Material</th><th>Unit price</th><th>Qty</th><th>Line total</th></tr></thead>
          <tbody>
            ${audit.materials.map(m => `
              <tr>
                <td>${m.name}</td>
                <td>${moneyEUR(m.price)}</td>
                <td>${m.quantity}</td>
                <td>${moneyEUR(m.lineTotal)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `}

      ${isOpen ? `
        <hr style="border:none;border-top:1px solid #eee;margin:14px 0;" />
        <h4>Add material</h4>
        <div class="row">
          <div>
            <label>Material</label>
            <select id="materialId">
              <option value="">Select material...</option>
              ${allMaterials.map(m => `<option value="${m.materialId}">${m.name} (${moneyEUR(m.price)})</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Quantity</label>
            <input id="qty" type="number" min="1" value="1" />
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button id="btnAddMaterial">Add material</button>
        </div>
      ` : ""}
    </div>

    <div class="card">
      <h3>Finalize audit</h3>
      <p class="muted">End date must be later than creation date. After finalization, assignments are locked.</p>

      ${isOpen ? `
        <div class="row">
          <div>
            <label>End date</label>
            <input id="endDate" type="date" />
          </div>
          <div style="display:flex; align-items:flex-end;">
            <button id="btnFinalize">Finalize</button>
          </div>
        </div>
      ` : `<p class="muted">Already finalized.</p>`}
    </div>

    <div class="card">
      <button class="secondary" onclick="history.back()">Back</button>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");

    const btnAssignVisits = root.querySelector("#btnAssignVisits");
    if (btnAssignVisits) {
      btnAssignVisits.onclick = async () => {
        try {
          const ids = Array.from(root.querySelectorAll(".chkVisit"))
            .filter(x => x.checked)
            .map(x => Number(x.value));

          if (ids.length === 0) return toast("Select at least one visit");

          await auditsService.assignVisits(auditId, ids);
          toast("Visits assigned");
          location.hash = `#/audits/${encodeURIComponent(auditId)}`;
        } catch (e) {
          toast(e.message);
        }
      };
    }

    const btnAddMaterial = root.querySelector("#btnAddMaterial");
    if (btnAddMaterial) {
      btnAddMaterial.onclick = async () => {
        try {
          const materialId = root.querySelector("#materialId").value;
          const quantity = Number(root.querySelector("#qty").value);

          if (!materialId) return toast("Select a material");
          if (!Number.isInteger(quantity) || quantity < 1) return toast("Quantity must be >= 1");

          await auditsService.assignMaterials(auditId, [{ materialId: Number(materialId), quantity }]);
          toast("Material assigned");
          location.hash = `#/audits/${encodeURIComponent(auditId)}`;
        } catch (e) {
          toast(e.message);
        }
      };
    }

    const btnFinalize = root.querySelector("#btnFinalize");
    if (btnFinalize) {
      btnFinalize.onclick = async () => {
        try {
          const endDate = root.querySelector("#endDate").value;
          if (!endDate) return toast("Choose an end date");
          await auditsService.finalize(auditId, endDate);
          toast("Audit finalized");
          location.hash = `#/audits/${encodeURIComponent(auditId)}`;
        } catch (e) {
          toast(e.message);
        }
      };
    }
  }
}
