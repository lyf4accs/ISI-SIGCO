import { coursesService } from "../services/coursesService.js";
import { moneyEUR, toast } from "../components/ui.js";

export async function CoursesListView() {
  const html = `
    <div class="card">
      <div class="row">
        <div>
          <h2>Courses</h2>
          <p class="muted">Duration + enrolled are derived. Capacity is enforced on enrollment.</p>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:flex-end;">
          <button class="secondary" id="btnAdd">Add course</button>
        </div>
      </div>

      <div class="row">
        <div><label>Search</label><input id="q" placeholder="course name..." /></div>
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

    btnAdd.onclick = () => (location.hash = "#/courses/new");

    apply.onclick = async () => {
      try {
        const items = await coursesService.list({
          q: root.querySelector("#q").value.trim(),
          from: root.querySelector("#from").value.trim(),
          to: root.querySelector("#to").value.trim()
        });

        wrap.innerHTML = `
          <table>
            <thead><tr>
              <th>Name</th><th>Start</th><th>End</th><th>Price</th><th>Duration</th><th>Enrolled</th><th>Max</th><th>Capacity</th>
            </tr></thead>
            <tbody>
              ${items.map(c => `
                <tr data-id="${c.courseId}" style="cursor:pointer">
                  <td>${c.name}</td>
                  <td>${c.startDate}</td>
                  <td>${c.endDate}</td>
                  <td>${moneyEUR(c.price)}</td>
                  <td>${c.durationHours ?? 0}h</td>
                  <td>${c.enrolledCount ?? 0}</td>
                  <td>${c.maxResidents}</td>
                  <td>${c.hasCapacity ? "✅" : "FULL"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;

        wrap.querySelectorAll("tr[data-id]").forEach(tr => {
          tr.onclick = () => (location.hash = `#/courses/${encodeURIComponent(tr.dataset.id)}`);
        });
      } catch (e) {
        toast(e.message);
      }
    };

    apply.click();
  }
}
