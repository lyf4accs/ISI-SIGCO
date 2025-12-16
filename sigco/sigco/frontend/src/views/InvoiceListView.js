import { invoicesService } from "../services/invoicesService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function InvoiceListView() {
  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Invoices</h2>
          <p class="muted">Filter by resident DNI and date range.</p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end;">
          <button class="secondary" id="btnNew">Create invoice</button>
        </div>
      </div>

      <div class="row">
        <div><label>Resident DNI</label><input id="residentDni" placeholder="optional"/></div>
        <div><label>From</label><input id="from" placeholder="YYYY-MM-DD"/></div>
        <div><label>To</label><input id="to" placeholder="YYYY-MM-DD"/></div>
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

    const btnNew = root.querySelector("#btnNew");
    const apply = root.querySelector("#apply");
    const wrap = root.querySelector("#wrap");

    const residentDniEl = root.querySelector("#residentDni");
    const fromEl = root.querySelector("#from");
    const toEl = root.querySelector("#to");

    if (!btnNew || !apply || !wrap || !residentDniEl || !fromEl || !toEl) {
      console.error("InvoiceListView missing elements:", { btnNew, apply, wrap, residentDniEl, fromEl, toEl });
      return;
    }

    btnNew.onclick = () => (location.hash = "#/invoices/new");

    apply.onclick = async () => {
      try {
        const items = await invoicesService.list({
          residentDni: residentDniEl.value.trim(),
          from: fromEl.value.trim(),
          to: toEl.value.trim()
        });

        wrap.innerHTML = `
          <table>
            <thead><tr><th>InvoiceId</th><th>Date</th><th>Resident</th><th>#Visits</th><th>Total</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (i) => `
                <tr data-id="${i.invoiceId}" style="cursor:pointer">
                  <td>${i.invoiceId}</td>
                  <td>${i.creationDate}</td>
                  <td>${i.residentDni}</td>
                  <td>${i.visitIds.length}</td>
                  <td>${moneyEUR(i.totalAmount)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;

        wrap.querySelectorAll("tr[data-id]").forEach((tr) => {
          tr.onclick = () => (location.hash = `#/invoices/${encodeURIComponent(tr.dataset.id)}`);
        });
      } catch (e) {
        toast(e.message);
      }
    };

    apply.click();
  }
}
