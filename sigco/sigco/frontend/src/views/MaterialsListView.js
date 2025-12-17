import { materialsService } from "../services/materialsService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function MaterialsListView() {
  const items = await materialsService.list({ q: "" });

  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Materials</h2>
          <p class="muted">Repository for audits</p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:10px;">
          <input id="q" placeholder="Search by name..." />
          <button class="secondary" id="btnSearch">Search</button>
          <button id="btnNew">Add material</button>
        </div>
      </div>
    </div>

    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Price</th><th></th></tr></thead>
        <tbody>
          ${items.map(m => `
            <tr data-id="${m.materialId}" style="cursor:pointer">
              <td>${m.name}</td>
              <td>${moneyEUR(m.price)}</td>
              <td><button class="secondary" data-del="${m.materialId}">Delete</button></td>
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

    root.querySelector("#btnNew").onclick = () => (location.hash = "#/materials/new");
    root.querySelector("#btnSearch").onclick = async () => {
      const q = root.querySelector("#q").value.trim();
      const list = await materialsService.list({ q });
      root.innerHTML = await MaterialsListView();
      root.querySelector("#q").value = q;
    };

    root.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.onclick = (e) => {
        if (e.target?.dataset?.del) return;
        location.hash = `#/materials/${encodeURIComponent(tr.dataset.id)}`;
      };
    });

    root.querySelectorAll("button[data-del]").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        try {
          await materialsService.remove(btn.dataset.del);
          toast("Material deleted");
          location.hash = "#/materials";
        } catch (err) {
          toast(err.message);
        }
      };
    });
  }
}
