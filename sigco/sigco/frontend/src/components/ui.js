export function moneyEUR(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export function badge(status) {
  const s = String(status || "").toUpperCase();
  const cls = s === "UNPAID" ? "badge unpaid" : "badge paid";
  return `<span class="${cls}">${s}</span>`;
}

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}
