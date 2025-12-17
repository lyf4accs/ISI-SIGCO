import { auditsService } from "../services/auditsService.js";
import { auditorsService } from "../services/auditorsService.js";
import { moneyEUR } from "../components/ui.js";

export async function AuditsListView() {
  const [auditors, audits] = await Promise.all([
    auditorsService.list({ q: "" }),
    auditsService.list({})
  ]);

  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Audits</h2>
          <p class="muted">Salary is computed as 20% of visits total</p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:10px;">
          <button id="btnNew">Create audit</button>
        </div>
      </div>

      <div class="row" style="margin-top:10px;">
        <div>
          <label>Status</label>
          <select id="status">
            <option value="">All</option>
            <option value="OPEN">OPEN</option>
            <option value="FINALIZED">FINALIZED</option>
          </select>
        </div>
        <div>
          <label>Auditor</label>
          <select id="auditorId">
            <option value="">All</option>
            ${auditors.map(a => `<option value="${a.auditorId}">${a.companyName} (${a.companyCif})</option>`).join("")}
          </select>
        </div>
        <div>
          <label>From</label>
          <input id="from" type="date" />
        </div>
        <div>
          <label>To</label>
          <input id="to" type="date" />
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="secondary" id="btnFilter">Filter</button>
        </div>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>AuditId</th><th>Creation</th><th>End</th><th>Status</th>
            <th>Auditor</th><th>#Visits</th><th>Visits total</th><th>Salary</th>
          </tr>
        </thead>
        <tbody id="tbody">
          ${audits.map(a => `
            <tr data-id="${a.auditId}" style="cursor:pointer">
              <td>${a.auditId}</td>
              <td>${a.creationDate}</td>
              <td>${a.endDate ?? ""}</td>
              <td>${a.status}</td>
              <td>${a.auditorCompanyName}</td>
              <td>${a.visitsCount}</td>
              <td>${moneyEUR(a.auditedVisitsTotalAmount)}</td>
              <td><strong>${moneyEUR(a.auditorSalaryAmount)}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");

    root.querySelector("#btnNew").onclick = () => (location.hash = "#/audits/new");

    root.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.onclick = () => (location.hash = `#/audits/${encodeURIComponent(tr.dataset.id)}`);
    });

    root.querySelector("#btnFilter").onclick = async () => {
      const status = root.querySelector("#status").value;
      const auditorId = root.querySelector("#auditorId").value;
      const from = root.querySelector("#from").value;
      const to = root.querySelector("#to").value;

      const filtered = await auditsService.list({ status, auditorId, from, to });

      const tbody = root.querySelector("#tbody");
      tbody.innerHTML = filtered.map(a => `
        <tr data-id="${a.auditId}" style="cursor:pointer">
          <td>${a.auditId}</td>
          <td>${a.creationDate}</td>
          <td>${a.endDate ?? ""}</td>
          <td>${a.status}</td>
          <td>${a.auditorCompanyName}</td>
          <td>${a.visitsCount}</td>
          <td>${moneyEUR(a.auditedVisitsTotalAmount)}</td>
          <td><strong>${moneyEUR(a.auditorSalaryAmount)}</strong></td>
        </tr>
      `).join("");

      root.querySelectorAll("tr[data-id]").forEach(tr => {
        tr.onclick = () => (location.hash = `#/audits/${encodeURIComponent(tr.dataset.id)}`);
      });
    };
  }
}
