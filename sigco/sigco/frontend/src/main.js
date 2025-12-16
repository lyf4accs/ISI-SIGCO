import { toast } from "./components/ui.js";

import { ResidentListView } from "./views/ResidentListView.js";
import { ResidentFormView } from "./views/ResidentFormView.js";
import { ResidentDetailView } from "./views/ResidentDetailView.js";

import { VisitsListView } from "./views/VisitsListView.js";
import { VisitsFormView } from "./views/VisitsFormView.js";

import { InvoiceListView } from "./views/InvoiceListView.js";  
import { InvoiceCreateView } from "./views/InvoiceCreateView.js";
import { InvoiceDetailView } from "./views/InvoiceDetailView.js";

const app = document.getElementById("app");

function parseRoute() {
  const hash = location.hash || "#/residents";
  const parts = hash.replace("#", "").split("/").filter(Boolean);
  return parts;
}

async function render() {
  const parts = parseRoute();

  try {
    // Residents
    if (parts[0] === "residents" && parts.length === 1) {
      app.innerHTML = await ResidentListView();
      return;
    }
    if (parts[0] === "residents" && parts[1] === "new") {
      app.innerHTML = await ResidentFormView({ mode: "create" });
      return;
    }
    if (parts[0] === "residents" && parts.length === 2) {
      app.innerHTML = await ResidentDetailView({ dni: decodeURIComponent(parts[1]) });
      return;
    }

    // Visits
    if (parts[0] === "visits" && parts.length === 1) {
      app.innerHTML = await VisitsListView();
      return;
    }
    if (parts[0] === "visits" && parts[1] === "new") {
      const url = new URL(location.href);
      const residentDni = url.searchParams.get("residentDni") || "";
      app.innerHTML = await VisitsFormView({ residentDni });
      return;
    }

    // Invoices
    if (parts[0] === "invoices" && parts.length === 1) {
      app.innerHTML = await InvoiceListView();
      return;
    }
    if (parts[0] === "invoices" && parts[1] === "new") {
      const url = new URL(location.href);
      const residentDni = url.searchParams.get("residentDni") || "";
      app.innerHTML = await InvoiceCreateView({ residentDni });
      return;
    }
    if (parts[0] === "invoices" && parts.length === 2) {
      app.innerHTML = await InvoiceDetailView({ invoiceId: decodeURIComponent(parts[1]) });
      return;
    }

    // Default
    location.hash = "#/residents";
  } catch (e) {
    toast(e.message || "Unexpected error");
    app.innerHTML = `
      <div class="card">
        <h2>Error</h2>
        <p class="muted">${e.message || "Unexpected error"}</p>
      </div>
    `;
  }
}

window.addEventListener("hashchange", render);
window.addEventListener("load", render);
