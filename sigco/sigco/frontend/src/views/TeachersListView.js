import { teachersService } from "../services/teachersService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function TeachersListView() {
  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Teachers</h2>
          <p class="muted">Search by name or phone. Delete is blocked if assigned to subjects.</p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end;">
          <button class="secondary" id="btnAdd">Add teacher</button>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Search</label>
          <input id="q" placeholder="e.g. Pepa, +34..." />
        </div>
      </div>

      <div id="wrap" style="margin-top:12px;"></div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");
    const btnAdd = root.querySelector("#btnAdd");
    const qInput = root.querySelector("#q");
    const wrap = root.querySelector("#wrap");

    btnAdd.onclick = () => (location.hash = "#/teachers/new");

    async function refresh() {
      try {
        const q = qInput.value.trim();
        const items = await teachersService.list({ q });

        wrap.innerHTML = `
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Salary</th><th></th></tr></thead>
            <tbody>
              ${items.map(t => `
                <tr data-id="${t.teacherId}">
                  <td>${t.firstName} ${t.lastName}</td>
                  <td>${t.phone}</td>
                  <td>${moneyEUR(t.salary)}</td>
                  <td style="display:flex; gap:8px; justify-content:flex-end;">
                    <button class="secondary" data-edit="${t.teacherId}">Edit</button>
                    <button data-del="${t.teacherId}">Delete</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;

        wrap.querySelectorAll("[data-edit]").forEach(b => {
          b.onclick = () => (location.hash = `#/teachers/${encodeURIComponent(b.dataset.edit)}`);
        });

        wrap.querySelectorAll("[data-del]").forEach(b => {
          b.onclick = async () => {
            if (!confirm("Delete teacher? This will fail if the teacher is assigned to any subject.")) return;
            try {
              await teachersService.remove(b.dataset.del);
              toast("Teacher deleted");
              refresh();
            } catch (e) {
              toast(e.message);
            }
          };
        });
      } catch (e) {
        toast(e.message);
      }
    }

    qInput.addEventListener("input", () => refresh());
    refresh();
  }
}
