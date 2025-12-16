import { invoicesService } from "../services/invoicesService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function InvoiceDetailView({ invoiceId }) {
  try {
    const inv = await invoicesService.get(invoiceId);

    const html = `
      <div class="card">
        <div class="row">
          <div>
            <h2>Invoice #${inv.invoiceId}</h2>
            <p class="muted">Resident: <strong>${inv.residentDni}</strong> · Date: <strong>${inv.creationDate}</strong></p>
          </div>
          <div style="display:flex; justify-content:flex-end; align-items:flex-end;">
            <div style="font-size:18px;"><strong>${moneyEUR(inv.totalAmount)}</strong></div>
          </div>
        </div>

        <h3 style="margin-top:12px;">Included visits</h3>
        <table>
          <thead><tr><th>Date</th><th>ManagerId</th><th>Amount</th><th>Description</th></tr></thead>
          <tbody>
            ${inv.visits.map(v => `
              <tr>
                <td>${v.visitDate}</td>
                <td>${v.managerId}</td>
                <td>${moneyEUR(v.amount)}</td>
                <td>${v.description}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div style="display:flex; gap:10px; margin-top:12px;">
          <button class="secondary" id="btnBack">Back</button>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      const root = document.getElementById("app");
      const btn = root?.querySelector("#btnBack");
      if (btn) btn.onclick = () => history.back();
    });

    return html;
  } catch (e) {
    toast(e.message);
    return `<div class="card"><h2>Invoice not found</h2><p class="muted">${e.message}</p></div>`;
  }
}
