import { residentsService } from "../services/residentsService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function ResidentListView() {
  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Residents</h2>
          <p class="muted">Search by DNI / name / city. Toggle unpaid-only.</p>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; align-items:flex-end;">
          <button class="secondary" id="btnAdd">Add resident</button>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Search</label>
          <input id="q" placeholder="e.g. 12345678A, Ana, Valencia" />
        </div>
        <div>
          <label>&nbsp;</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input id="onlyUnpaid" type="checkbox" />
            <span>Only residents with unpaid visits</span>
          </div>
        </div>
      </div>

      <div id="tableWrap" style="margin-top:12px;"></div>
    </div>
  `;

  // Bind after the HTML is actually in the DOM
  requestAnimationFrame(bind);
  return html;

  async function bind() {
    const root = document.getElementById("app");

    const btnAdd = root.querySelector("#btnAdd");
    const qInput = root.querySelector("#q");
    const chk = root.querySelector("#onlyUnpaid");
    const tableWrap = root.querySelector("#tableWrap");

    if (!btnAdd || !qInput || !chk || !tableWrap) {
      console.error("ResidentListView missing elements:", { btnAdd, qInput, chk, tableWrap });
      return;
    }

    btnAdd.onclick = () => (location.hash = "#/residents/new");

    async function refresh() {
      const q = qInput.value.trim();
      const onlyUnpaid = chk.checked;
      const items = await residentsService.list({ q, onlyUnpaid });

      tableWrap.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>DNI</th><th>Name</th><th>City</th><th>Phone</th>
              <th>Unpaid #</th><th>Unpaid total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(r => `
              <tr data-dni="${r.dni}" style="cursor:pointer">
                <td>${r.dni}</td>
                <td>${r.firstName} ${r.lastName}</td>
                <td>${r.city}</td>
                <td>${r.phone}</td>
                <td>${r.unpaidVisitsCount}</td>
                <td>${moneyEUR(r.unpaidVisitsTotal)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      tableWrap.querySelectorAll("tr[data-dni]").forEach(tr => {
        tr.onclick = () => (location.hash = `#/residents/${encodeURIComponent(tr.dataset.dni)}`);
      });
    }

    qInput.addEventListener("input", () => refresh().catch(e => toast(e.message)));
    chk.addEventListener("change", () => refresh().catch(e => toast(e.message)));

    refresh().catch(e => toast(e.message));
  }
}
