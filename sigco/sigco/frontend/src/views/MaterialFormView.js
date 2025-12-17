import { materialsService } from "../services/materialsService.js";
import { toast } from "../components/ui.js";

export async function MaterialFormView({ mode, materialId } = {}) {
  const isEdit = mode === "edit";
  const m = isEdit ? await materialsService.get(materialId) : null;

  const html = `
    <div class="card">
      <h2>${isEdit ? "Edit material" : "New material"}</h2>

      <div class="row">
        <div>
          <label>Name</label>
          <input id="name" value="${m?.name ?? ""}" />
        </div>
        <div>
          <label>Price</label>
          <input id="price" type="number" step="0.01" value="${m?.price ?? ""}" />
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="btnSave">Save</button>
        <button class="secondary" onclick="history.back()">Cancel</button>
      </div>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");
    root.querySelector("#btnSave").onclick = async () => {
      const payload = {
        name: root.querySelector("#name").value.trim(),
        price: Number(root.querySelector("#price").value)
      };

      try {
        if (isEdit) await materialsService.update(materialId, payload);
        else await materialsService.create(payload);

        toast("Saved");
        location.hash = "#/materials";
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
