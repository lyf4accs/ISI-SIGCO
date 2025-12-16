import { residentsService } from "../services/residentsService.js";
import { toast } from "../components/ui.js";

export async function ResidentFormView({ mode }) {
  const html = `
    <div class="card">
      <h2>New resident</h2>
      <div class="row">
        <div><label>DNI</label><input id="dni" /></div>
        <div><label>First name</label><input id="firstName" /></div>
        <div><label>Last name(s)</label><input id="lastName" /></div>
        <div><label>Phone</label><input id="phone" /></div>
      </div>
      <div class="row">
        <div><label>Address</label><input id="address" /></div>
        <div><label>Postal code</label><input id="postalCode" /></div>
        <div><label>City</label><input id="city" /></div>
      </div>
      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="save">Save</button>
        <button class="secondary" id="cancel">Cancel</button>
      </div>
      <p class="muted" style="margin-top:12px;">Backend enforces DNI uniqueness and formats.</p>
    </div>
  `;

  requestAnimationFrame(bind);
  return html;

  function bind() {
    const root = document.getElementById("app");

    const cancel = root.querySelector("#cancel");
    const save = root.querySelector("#save");

    const dniEl = root.querySelector("#dni");
    const firstNameEl = root.querySelector("#firstName");
    const lastNameEl = root.querySelector("#lastName");
    const addressEl = root.querySelector("#address");
    const postalCodeEl = root.querySelector("#postalCode");
    const cityEl = root.querySelector("#city");
    const phoneEl = root.querySelector("#phone");

    if (cancel) cancel.onclick = () => (location.hash = "#/residents");

    if (!save || !dniEl || !firstNameEl || !lastNameEl || !addressEl || !postalCodeEl || !cityEl || !phoneEl) {
      console.error("ResidentFormView missing elements");
      return;
    }

    save.onclick = async () => {
      try {
        const payload = {
          dni: dniEl.value.trim(),
          firstName: firstNameEl.value.trim(),
          lastName: lastNameEl.value.trim(),
          address: addressEl.value.trim(),
          postalCode: postalCodeEl.value.trim(),
          city: cityEl.value.trim(),
          phone: phoneEl.value.trim()
        };

        await residentsService.create(payload);
        toast("Resident created");
        location.hash = "#/residents";
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
