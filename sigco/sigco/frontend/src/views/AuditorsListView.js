import { auditorsService } from "../services/auditorsService.js";
import { toast } from "../components/ui.js";

export async function AuditorsListView() {
  const items = await auditorsService.list({ q: "" });

  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Auditors</h2>
          <p class="muted">External auditors registry</p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:10px;">
          <input id="q" placeholder="Search (name, company, CIF, phone)..." />
          <button class="secondary" id="btnSearch">Search</button>
          <button id="btnNew">Add auditor</button>
        </div>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Company</th><th>CIF</th><th>Phone</th><th>Audits</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${items.map(a => `
            <tr data-id="${a.auditorId}" style="cursor:pointer">
              <td>${a.firstName} ${a.lastName}</td>
              <td>${a.companyName}</td>
              <td>${a.companyCif}</td>
              <td>${a.companyPhone}</td>
              <td>${a.auditsCount ?? 0}</td>
              <td><button class="secondary" data-del="${a.auditorId}">Delete</button></td>
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

    root.querySelector("#btnNew").onclick = () => (location.hash = "#/auditors/new");
    root.querySelector("#btnSearch").onclick = async () => {
      const q = root.querySelector("#q").value.trim();
      const list = await auditorsService.list({ q });
      root.innerHTML = await AuditorsListView(); // simple refresh
      root.querySelector("#q").value = q;
    };

    root.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.onclick = (e) => {
        if (e.target?.dataset?.del) return;
        location.hash = `#/auditors/${encodeURIComponent(tr.dataset.id)}`;
      };
    });

    root.querySelectorAll("button[data-del]").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        try {
          await auditorsService.remove(btn.dataset.del);
          toast("Auditor deleted");
          location.hash = "#/auditors";
        } catch (err) {
          toast(err.message);
        }
      };
    });
  }
}
