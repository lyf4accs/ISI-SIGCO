import { residentsService } from "../services/residentsService.js";
import { visitsService } from "../services/visitsService.js";
import { invoicesService } from "../services/invoicesService.js";
import { badge, moneyEUR } from "../components/ui.js";

export async function ResidentDetailView({ dni }) {
  const r = await residentsService.get(dni);
  const unpaid = await residentsService.unpaid(dni);
  const visits = await visitsService.list({ residentDni: dni });
  const invoices = await invoicesService.list({ residentDni: dni });

  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>${r.firstName} ${r.lastName}</h2>
          <p class="muted">DNI: <strong>${r.dni}</strong> · ${r.address}, ${r.postalCode} ${r.city} · ${r.phone}</p>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; align-items:flex-end;">
          <button class="secondary" id="btnVisit">Register visit</button>
          <button id="btnInvoice" ${unpaid.unpaidVisitsCount === 0 ? "disabled" : ""}>Create invoice</button>
        </div>
      </div>

      <div class="card" style="background:#f9fafb">
        <strong>Unpaid summary:</strong>
        ${unpaid.unpaidVisitsCount} visit(s) · <strong>${moneyEUR(unpaid.unpaidVisitsTotal)}</strong>
        ${unpaid.unpaidVisitsCount === 0 ? `<div class="muted" style="margin-top:6px;">This resident has no pending visits to invoice.</div>` : ""}
      </div>
    </div>

    <div class="card">
      <h3>Visits</h3>
      <table>
        <thead><tr><th>Date</th><th>ManagerId</th><th>Amount</th><th>Status</th><th>Invoice</th><th>Description</th></tr></thead>
        <tbody>
          ${visits
            .map(
              (v) => `
            <tr>
              <td>${v.visitDate}</td>
              <td>${v.managerId}</td>
              <td>${moneyEUR(v.amount)}</td>
              <td>${badge(v.status)}</td>
              <td>${v.invoiceId ?? ""}</td>
              <td>${v.description}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>Invoices</h3>
      <table>
        <thead><tr><th>InvoiceId</th><th>Date</th><th>#Visits</th><th>Total</th></tr></thead>
        <tbody>
          ${invoices
            .map(
              (i) => `
            <tr data-id="${i.invoiceId}" style="cursor:pointer">
              <td>${i.invoiceId}</td>
              <td>${i.creationDate}</td>
              <td>${i.visitIds.length}</td>
              <td>${moneyEUR(i.totalAmount)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");

    const btnVisit = root.querySelector("#btnVisit");
    const btnInvoice = root.querySelector("#btnInvoice");

    if (btnVisit) btnVisit.onclick = () => (location.hash = `#/visits/new?residentDni=${encodeURIComponent(dni)}`);
    if (btnInvoice) btnInvoice.onclick = () => (location.hash = `#/invoices/new?residentDni=${encodeURIComponent(dni)}`);

    root.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.onclick = () => (location.hash = `#/invoices/${encodeURIComponent(tr.dataset.id)}`);
    });
  }
}
