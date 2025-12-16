import { visitsService } from "../services/visitsService.js";
import { badge, moneyEUR, toast } from "../components/ui.js";

export async function VisitsListView() {
  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Visits</h2>
          <p class="muted">Filter by status / resident DNI / date range.</p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end;">
          <button class="secondary" id="btnAdd">Add visit</button>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Status</label>
          <select id="status">
            <option value="">All</option>
            <option value="UNPAID">UNPAID</option>
            <option value="PAID">PAID</option>
          </select>
        </div>
        <div><label>Resident DNI</label><input id="residentDni" placeholder="optional" /></div>
        <div><label>From</label><input id="from" placeholder="YYYY-MM-DD" /></div>
        <div><label>To</label><input id="to" placeholder="YYYY-MM-DD" /></div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="apply">Apply filters</button>
      </div>

      <div id="wrap" style="margin-top:12px;"></div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");

    const btnAdd = root.querySelector("#btnAdd");
    const apply = root.querySelector("#apply");
    const wrap = root.querySelector("#wrap");

    const statusEl = root.querySelector("#status");
    const residentEl = root.querySelector("#residentDni");
    const fromEl = root.querySelector("#from");
    const toEl = root.querySelector("#to");

    if (!btnAdd || !apply || !wrap || !statusEl || !residentEl || !fromEl || !toEl) {
      console.error("VisitsListView missing elements");
      return;
    }

    btnAdd.onclick = () => (location.hash = "#/visits/new");

    apply.onclick = async () => {
      try {
        const items = await visitsService.list({
          status: statusEl.value || "",
          residentDni: residentEl.value.trim(),
          from: fromEl.value.trim(),
          to: toEl.value.trim()
        });

        wrap.innerHTML = `
          <table>
            <thead><tr><th>Date</th><th>Resident</th><th>ManagerId</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (v) => `
                <tr>
                  <td>${v.visitDate}</td>
                  <td>${v.residentDni}</td>
                  <td>${v.managerId}</td>
                  <td>${moneyEUR(v.amount)}</td>
                  <td>${badge(v.status)}</td>
                  <td>${v.invoiceId ?? ""}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;
      } catch (e) {
        toast(e.message);
      }
    };

    apply.click();
  }
}
