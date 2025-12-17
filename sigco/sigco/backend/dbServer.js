const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
// Prevent browser/proxy caching for API responses (avoids 304 stale UI)
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});


const DB_PATH = path.join(__dirname, "db.json");

// ---------- Persistence helpers ----------
function ensureDbShape(input) {
  const db = input || {};
  const shaped = {
    residents: Array.isArray(db.residents) ? db.residents : [],
    managers: Array.isArray(db.managers) ? db.managers : [],
    visits: Array.isArray(db.visits) ? db.visits : [],
    invoices: Array.isArray(db.invoices) ? db.invoices : [],

    // Exercise 2
    teachers: Array.isArray(db.teachers) ? db.teachers : [],
    courses: Array.isArray(db.courses) ? db.courses : [],
    subjects: Array.isArray(db.subjects) ? db.subjects : [],
    enrollments: Array.isArray(db.enrollments) ? db.enrollments : [],

    counters: {
      // Exercise 1
      visitId: Number(db?.counters?.visitId ?? 1000),
      invoiceId: Number(db?.counters?.invoiceId ?? 5000),
      managerId: Number(db?.counters?.managerId ?? 0),

      // Exercise 2
      teacherId: Number(db?.counters?.teacherId ?? 0),
      courseId: Number(db?.counters?.courseId ?? 0),
      subjectId: Number(db?.counters?.subjectId ?? 0),
      enrollmentId: Number(db?.counters?.enrollmentId ?? 0)
    }
  };

  return shaped;
}

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const init = ensureDbShape({});
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), "utf-8");
    return init;
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return ensureDbShape(JSON.parse(raw));
}

// Windows-safe atomic-ish write (avoids EPERM rename)
function saveDbAtomic(db) {
  const tmp = DB_PATH + ".tmp";
  const content = JSON.stringify(db, null, 2);

  fs.writeFileSync(tmp, content, "utf-8");
  fs.copyFileSync(tmp, DB_PATH);
  try { fs.unlinkSync(tmp); } catch {}
}

// Serialize all writes
let writeQueue = Promise.resolve();
function withDbWrite(fn) {
  writeQueue = writeQueue
    .catch(() => {}) // recover if a previous write failed
    .then(() => {
      const db = loadDb();
      const result = fn(db);
      saveDbAtomic(db);
      return result;
    });
  return writeQueue;
}

function nextId(db, key) {
  db.counters[key] = Number(db.counters[key] ?? 0) + 1;
  return db.counters[key];
}

// ---------- Validation helpers ----------
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validatePostalCode(pc) {
  return /^\d{5}$/.test(String(pc ?? "").trim());
}

function validatePhone(phone) {
  const s = String(phone ?? "").trim();
  if (s.length < 9 || s.length > 15) return false;
  return /^[0-9+\s]+$/.test(s);
}

function parseMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function parsePositiveInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parsePositiveNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "").trim());
}

function httpError(res, status, message, details) {
  return res.status(status).json({ error: message, details });
}

// ---------- Domain integrity checks (Exercise 1) ----------
function residentExists(db, dni) {
  return db.residents.some(r => r.dni === dni);
}

function managerExists(db, managerId) {
  return db.managers.some(m => String(m.managerId) === String(managerId));
}

function unpaidVisitsOfResident(db, dni) {
  return db.visits.filter(v => v.residentDni === dni && v.invoiceId == null);
}

function computeResidentUnpaidStats(db, dni) {
  const unpaid = unpaidVisitsOfResident(db, dni);
  const count = unpaid.length;
  const total = unpaid.reduce((sum, v) => sum + Number(v.amount || 0), 0);
  return {
    hasUnpaidVisits: count > 0,
    unpaidVisitsCount: count,
    unpaidVisitsTotal: Math.round(total * 100) / 100
  };
}

function enforceVisitPaidConsistency(visit) {
  const paid = visit.invoiceId != null;
  visit.status = paid ? "PAID" : "UNPAID";
  if (!paid) visit.invoiceId = null;
}

// ---------- Domain helpers (Exercise 2) ----------
const findTeacher = (db, id) => db.teachers.find(t => String(t.teacherId) === String(id));
const findCourse = (db, id) => db.courses.find(c => String(c.courseId) === String(id));
const findResident = (db, dni) => db.residents.find(r => r.dni === dni);

function courseDurationHours(db, courseId) {
  return db.subjects
    .filter(s => String(s.courseId) === String(courseId))
    .reduce((sum, s) => sum + Number(s.hours || 0), 0);
}

function courseEnrolledCount(db, courseId) {
  return db.enrollments.filter(e => String(e.courseId) === String(courseId)).length;
}

function courseHasCapacity(db, course) {
  return courseEnrolledCount(db, course.courseId) < Number(course.maxResidents);
}

function enrichCourse(db, course) {
  const durationHours = courseDurationHours(db, course.courseId);
  const enrolledCount = courseEnrolledCount(db, course.courseId);
  const hasCapacity = enrolledCount < Number(course.maxResidents);
  return { ...course, durationHours, enrolledCount, hasCapacity };
}

// ---------- Health ----------
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ===================== Residents =====================
app.get("/api/residents", (req, res) => {
  const db = loadDb();
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const onlyUnpaid = String(req.query.onlyUnpaid ?? "false") === "true";

  let items = db.residents;

  if (q) {
    items = items.filter(r => {
      const hay = `${r.dni} ${r.firstName} ${r.lastName} ${r.city}`.toLowerCase();
      return hay.includes(q);
    });
  }

  let enriched = items.map(r => ({ ...r, ...computeResidentUnpaidStats(db, r.dni) }));
  if (onlyUnpaid) enriched = enriched.filter(r => r.hasUnpaidVisits);

  res.json(enriched);
});

app.get("/api/residents/:dni", (req, res) => {
  const db = loadDb();
  const dni = req.params.dni;
  const r = db.residents.find(x => x.dni === dni);
  if (!r) return httpError(res, 404, "Resident not found");
  res.json({ ...r, ...computeResidentUnpaidStats(db, dni) });
});

app.post("/api/residents", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const dni = String(payload.dni ?? "").trim();

    if (!isNonEmptyString(dni)) return httpError(res, 400, "DNI is required");
    const required = ["firstName", "lastName", "address", "postalCode", "city", "phone"];
    for (const k of required) {
      if (!isNonEmptyString(payload[k])) return httpError(res, 400, `${k} is required`);
    }
    if (!validatePostalCode(payload.postalCode)) return httpError(res, 400, "Invalid postal code (expected 5 digits)");
    if (!validatePhone(payload.phone)) return httpError(res, 400, "Invalid phone (digits/spaces/+; 9..15 chars)");

    const created = await withDbWrite(db => {
      if (db.residents.some(r => r.dni === dni)) {
        const err = new Error("Duplicate DNI");
        err.status = 409;
        throw err;
      }
      const resident = {
        dni,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        address: payload.address.trim(),
        postalCode: String(payload.postalCode).trim(),
        city: payload.city.trim(),
        phone: String(payload.phone).trim()
      };
      db.residents.push(resident);
      return resident;
    });

    return res.status(201).json(created);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.put("/api/residents/:dni", async (req, res) => {
  try {
    const dni = req.params.dni;
    const payload = req.body ?? {};

    const updated = await withDbWrite(db => {
      const idx = db.residents.findIndex(r => r.dni === dni);
      if (idx < 0) {
        const err = new Error("Resident not found");
        err.status = 404;
        throw err;
      }
      const r = db.residents[idx];
      const next = { ...r };

      const allowed = ["firstName", "lastName", "address", "postalCode", "city", "phone"];
      for (const k of allowed) {
        if (payload[k] != null) next[k] = String(payload[k]).trim();
      }

      for (const k of allowed) {
        if (!isNonEmptyString(next[k])) {
          const err = new Error(`${k} is required`);
          err.status = 400;
          throw err;
        }
      }
      if (!validatePostalCode(next.postalCode)) {
        const err = new Error("Invalid postal code");
        err.status = 400;
        throw err;
      }
      if (!validatePhone(next.phone)) {
        const err = new Error("Invalid phone");
        err.status = 400;
        throw err;
      }

      db.residents[idx] = next;
      return next;
    });

    res.json(updated);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.delete("/api/residents/:dni", async (req, res) => {
  try {
    const dni = req.params.dni;
    await withDbWrite(db => {
      const r = db.residents.find(x => x.dni === dni);
      if (!r) {
        const err = new Error("Resident not found");
        err.status = 404;
        throw err;
      }
      const hasVisits = db.visits.some(v => v.residentDni === dni);
      const hasInvoices = db.invoices.some(i => i.residentDni === dni);
      if (hasVisits || hasInvoices) {
        const err = new Error("Cannot delete resident with visits or invoices");
        err.status = 409;
        throw err;
      }
      db.residents = db.residents.filter(x => x.dni !== dni);
    });
    res.json({ ok: true });
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.get("/api/residents/:dni/unpaid-visits", (req, res) => {
  const db = loadDb();
  const dni = req.params.dni;
  if (!residentExists(db, dni)) return httpError(res, 404, "Resident not found");
  const visits = unpaidVisitsOfResident(db, dni).map(v => ({ ...v, status: "UNPAID", invoiceId: null }));
  const total = visits.reduce((s, v) => s + Number(v.amount || 0), 0);
  res.json({
    residentDni: dni,
    unpaidVisits: visits,
    unpaidVisitsCount: visits.length,
    unpaidVisitsTotal: Math.round(total * 100) / 100
  });
});

// ===================== Managers =====================
app.get("/api/managers", (req, res) => {
  const db = loadDb();
  res.json(db.managers);
});

app.post("/api/managers", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!isNonEmptyString(name)) return httpError(res, 400, "name is required");

    const created = await withDbWrite(db => {
      const dup = db.managers.some(m => m.name.toLowerCase() === name.toLowerCase());
      if (dup) {
        const err = new Error("Manager name already exists");
        err.status = 409;
        throw err;
      }
      const manager = { managerId: nextId(db, "managerId"), name };
      db.managers.push(manager);
      return manager;
    });

    res.status(201).json(created);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.put("/api/managers/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const name = String(req.body?.name ?? "").trim();
    if (!isNonEmptyString(name)) return httpError(res, 400, "name is required");

    const updated = await withDbWrite(db => {
      const idx = db.managers.findIndex(m => String(m.managerId) === String(id));
      if (idx < 0) {
        const err = new Error("Manager not found");
        err.status = 404;
        throw err;
      }
      const dup = db.managers.some(m => String(m.managerId) !== String(id) && m.name.toLowerCase() === name.toLowerCase());
      if (dup) {
        const err = new Error("Manager name already exists");
        err.status = 409;
        throw err;
      }
      db.managers[idx] = { ...db.managers[idx], name };
      return db.managers[idx];
    });

    res.json(updated);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.delete("/api/managers/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await withDbWrite(db => {
      const m = db.managers.find(x => String(x.managerId) === String(id));
      if (!m) {
        const err = new Error("Manager not found");
        err.status = 404;
        throw err;
      }
      const used = db.visits.some(v => String(v.managerId) === String(id));
      if (used) {
        const err = new Error("Cannot delete manager referenced by visits");
        err.status = 409;
        throw err;
      }
      db.managers = db.managers.filter(x => String(x.managerId) !== String(id));
    });
    res.json({ ok: true });
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// ===================== Visits =====================
app.get("/api/visits", (req, res) => {
  const db = loadDb();
  const status = String(req.query.status ?? "").toUpperCase();
  const residentDni = String(req.query.residentDni ?? "").trim();
  const from = String(req.query.from ?? "").trim();
  const to = String(req.query.to ?? "").trim();

  let items = db.visits.map(v => {
    const copy = { ...v };
    enforceVisitPaidConsistency(copy);
    return copy;
  });

  if (residentDni) items = items.filter(v => v.residentDni === residentDni);
  if (status === "PAID") items = items.filter(v => v.invoiceId != null);
  if (status === "UNPAID") items = items.filter(v => v.invoiceId == null);
  if (from) items = items.filter(v => v.visitDate >= from);
  if (to) items = items.filter(v => v.visitDate <= to);

  items.sort((a, b) => (a.visitDate < b.visitDate ? 1 : -1));
  res.json(items);
});

app.get("/api/visits/:visitId", (req, res) => {
  const db = loadDb();
  const id = req.params.visitId;
  const v = db.visits.find(x => String(x.visitId) === String(id));
  if (!v) return httpError(res, 404, "Visit not found");
  const out = { ...v };
  enforceVisitPaidConsistency(out);
  res.json(out);
});

app.post("/api/visits", async (req, res) => {
  try {
    const p = req.body ?? {};
    const residentDni = String(p.residentDni ?? "").trim();
    const managerId = p.managerId;
    const visitDate = String(p.visitDate ?? "").trim();
    const description = String(p.description ?? "").trim();
    const amount = parseMoney(p.amount);

    if (!isNonEmptyString(residentDni)) return httpError(res, 400, "residentDni is required");
    if (!isNonEmptyString(visitDate)) return httpError(res, 400, "visitDate is required (YYYY-MM-DD)");
    if (!isNonEmptyString(description) || description.length < 5) return httpError(res, 400, "description is required (min 5 chars)");
    if (amount == null || amount <= 0) return httpError(res, 400, "amount must be > 0");
    if (managerId == null) return httpError(res, 400, "managerId is required");

    const created = await withDbWrite(db => {
      if (!residentExists(db, residentDni)) {
        const err = new Error("Unknown resident");
        err.status = 404;
        throw err;
      }
      if (!managerExists(db, managerId)) {
        const err = new Error("Unknown manager");
        err.status = 404;
        throw err;
      }

      const visit = {
        visitId: nextId(db, "visitId"),
        residentDni,
        visitDate,
        description,
        amount,
        managerId,
        status: "UNPAID",
        invoiceId: null
      };
      enforceVisitPaidConsistency(visit);
      db.visits.push(visit);
      return visit;
    });

    res.status(201).json(created);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.put("/api/visits/:visitId", async (req, res) => {
  try {
    const id = req.params.visitId;
    const p = req.body ?? {};

    const updated = await withDbWrite(db => {
      const idx = db.visits.findIndex(v => String(v.visitId) === String(id));
      if (idx < 0) {
        const err = new Error("Visit not found");
        err.status = 404;
        throw err;
      }

      const current = db.visits[idx];
      enforceVisitPaidConsistency(current);
      const isPaid = current.invoiceId != null;

      if (isPaid) {
        if (p.description != null) {
          const desc = String(p.description).trim();
          if (!isNonEmptyString(desc) || desc.length < 5) {
            const err = new Error("description is required (min 5 chars)");
            err.status = 400;
            throw err;
          }
          current.description = desc;
        }
        db.visits[idx] = current;
        return current;
      }

      if (p.residentDni != null) {
        const dni = String(p.residentDni).trim();
        if (!residentExists(db, dni)) {
          const err = new Error("Unknown resident");
          err.status = 404;
          throw err;
        }
        current.residentDni = dni;
      }
      if (p.managerId != null) {
        if (!managerExists(db, p.managerId)) {
          const err = new Error("Unknown manager");
          err.status = 404;
          throw err;
        }
        current.managerId = p.managerId;
      }
      if (p.visitDate != null) {
        const d = String(p.visitDate).trim();
        if (!isNonEmptyString(d)) {
          const err = new Error("visitDate is required");
          err.status = 400;
          throw err;
        }
        current.visitDate = d;
      }
      if (p.amount != null) {
        const a = parseMoney(p.amount);
        if (a == null || a <= 0) {
          const err = new Error("amount must be > 0");
          err.status = 400;
          throw err;
        }
        current.amount = a;
      }
      if (p.description != null) {
        const desc = String(p.description).trim();
        if (!isNonEmptyString(desc) || desc.length < 5) {
          const err = new Error("description is required (min 5 chars)");
          err.status = 400;
          throw err;
        }
        current.description = desc;
      }

      current.invoiceId = null;
      enforceVisitPaidConsistency(current);

      db.visits[idx] = current;
      return current;
    });

    res.json(updated);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.delete("/api/visits/:visitId", async (req, res) => {
  try {
    const id = req.params.visitId;
    await withDbWrite(db => {
      const v = db.visits.find(x => String(x.visitId) === String(id));
      if (!v) {
        const err = new Error("Visit not found");
        err.status = 404;
        throw err;
      }
      enforceVisitPaidConsistency(v);
      if (v.invoiceId != null) {
        const err = new Error("Cannot delete PAID visit");
        err.status = 409;
        throw err;
      }
      db.visits = db.visits.filter(x => String(x.visitId) !== String(id));
    });
    res.json({ ok: true });
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// ===================== Invoices (atomic transaction) =====================
app.get("/api/invoices", (req, res) => {
  const db = loadDb();
  const residentDni = String(req.query.residentDni ?? "").trim();
  const from = String(req.query.from ?? "").trim();
  const to = String(req.query.to ?? "").trim();

  let items = db.invoices;
  if (residentDni) items = items.filter(i => i.residentDni === residentDni);
  if (from) items = items.filter(i => i.creationDate >= from);
  if (to) items = items.filter(i => i.creationDate <= to);

  items = [...items].sort((a, b) => (a.creationDate < b.creationDate ? 1 : -1));
  res.json(items);
});

app.get("/api/invoices/:invoiceId", (req, res) => {
  const db = loadDb();
  const id = req.params.invoiceId;
  const inv = db.invoices.find(x => String(x.invoiceId) === String(id));
  if (!inv) return httpError(res, 404, "Invoice not found");

  const visits = inv.visitIds
    .map(vid => db.visits.find(v => String(v.visitId) === String(vid)))
    .filter(Boolean)
    .map(v => {
      const out = { ...v };
      enforceVisitPaidConsistency(out);
      return out;
    });

  res.json({ ...inv, visits });
});

app.post("/api/invoices", async (req, res) => {
  try {
    const residentDni = String(req.body?.residentDni ?? "").trim();
    const creationDate = String(req.body?.creationDate ?? "").trim();

    if (!isNonEmptyString(residentDni)) return httpError(res, 400, "residentDni is required");
    if (!isNonEmptyString(creationDate)) return httpError(res, 400, "creationDate is required (YYYY-MM-DD)");

    const invoice = await withDbWrite(db => {
      if (!residentExists(db, residentDni)) {
        const err = new Error("Resident not found");
        err.status = 404;
        throw err;
      }

      const unpaid = unpaidVisitsOfResident(db, residentDni);

      if (unpaid.length === 0) {
        const err = new Error("No unpaid visits for this resident");
        err.status = 409;
        throw err;
      }

      for (const v of unpaid) {
        if (v.invoiceId != null) {
          const err = new Error("Concurrency conflict: some visits were already invoiced");
          err.status = 409;
          throw err;
        }
      }

      const visitIds = unpaid.map(v => v.visitId);
      const totalAmount = Math.round(unpaid.reduce((s, v) => s + Number(v.amount || 0), 0) * 100) / 100;

      const invoiceId = nextId(db, "invoiceId");
      const newInvoice = { invoiceId, residentDni, creationDate, visitIds, totalAmount };
      db.invoices.push(newInvoice);

      db.visits = db.visits.map(v => {
        if (visitIds.some(id => String(id) === String(v.visitId))) {
          const updated = { ...v, invoiceId, status: "PAID" };
          enforceVisitPaidConsistency(updated);
          return updated;
        }
        return v;
      });

      return newInvoice;
    });

    res.status(201).json(invoice);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// =======================================================================
// ===================== Exercise 2: Teachers/Courses =====================
// =======================================================================

// --------------------- Teachers ---------------------
app.get("/api/teachers", (req, res) => {
  const db = loadDb();
  const q = String(req.query.q ?? "").trim().toLowerCase();

  let items = db.teachers;
  if (q) {
    items = items.filter(t => {
      const hay = `${t.firstName} ${t.lastName} ${t.phone}`.toLowerCase();
      return hay.includes(q);
    });
  }

  // optional derived: subjectsCount
  const enriched = items.map(t => ({
    ...t,
    subjectsCount: db.subjects.filter(s => String(s.teacherId) === String(t.teacherId)).length
  }));

  res.json(enriched);
});

app.get("/api/teachers/:teacherId", (req, res) => {
  const db = loadDb();
  const t = findTeacher(db, req.params.teacherId);
  if (!t) return httpError(res, 404, "Teacher not found");

  const subjectsCount = db.subjects.filter(s => String(s.teacherId) === String(t.teacherId)).length;
  res.json({ ...t, subjectsCount });
});

app.post("/api/teachers", async (req, res) => {
  try {
    const p = req.body ?? {};

    const firstName = String(p.firstName ?? "").trim();
    const lastName = String(p.lastName ?? "").trim();
    const address = String(p.address ?? "").trim();
    const phone = String(p.phone ?? "").trim();
    const salary = parsePositiveNumber(p.salary);

    if (!isNonEmptyString(firstName)) return httpError(res, 400, "firstName is required");
    if (!isNonEmptyString(lastName)) return httpError(res, 400, "lastName is required");
    if (!isNonEmptyString(address)) return httpError(res, 400, "address is required");
    if (!validatePhone(phone)) return httpError(res, 400, "Invalid phone");
    if (salary == null) return httpError(res, 400, "salary must be > 0");

    const created = await withDbWrite(db => {
      const teacher = {
        teacherId: nextId(db, "teacherId"),
        firstName,
        lastName,
        address,
        phone,
        salary: Math.round(salary * 100) / 100
      };
      db.teachers.push(teacher);
      return teacher;
    });

    res.status(201).json(created);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.put("/api/teachers/:teacherId", async (req, res) => {
  try {
    const id = req.params.teacherId;
    const p = req.body ?? {};

    const updated = await withDbWrite(db => {
      const idx = db.teachers.findIndex(t => String(t.teacherId) === String(id));
      if (idx < 0) {
        const err = new Error("Teacher not found");
        err.status = 404;
        throw err;
      }

      const current = db.teachers[idx];
      const next = { ...current };

      if (p.firstName != null) next.firstName = String(p.firstName).trim();
      if (p.lastName != null) next.lastName = String(p.lastName).trim();
      if (p.address != null) next.address = String(p.address).trim();
      if (p.phone != null) next.phone = String(p.phone).trim();
      if (p.salary != null) next.salary = Math.round(Number(p.salary) * 100) / 100;

      if (!isNonEmptyString(next.firstName)) {
        const err = new Error("firstName is required");
        err.status = 400;
        throw err;
      }
      if (!isNonEmptyString(next.lastName)) {
        const err = new Error("lastName is required");
        err.status = 400;
        throw err;
      }
      if (!isNonEmptyString(next.address)) {
        const err = new Error("address is required");
        err.status = 400;
        throw err;
      }
      if (!validatePhone(next.phone)) {
        const err = new Error("Invalid phone");
        err.status = 400;
        throw err;
      }
      if (!Number.isFinite(Number(next.salary)) || Number(next.salary) <= 0) {
        const err = new Error("salary must be > 0");
        err.status = 400;
        throw err;
      }

      db.teachers[idx] = next;
      return next;
    });

    res.json(updated);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.delete("/api/teachers/:teacherId", async (req, res) => {
  try {
    const id = req.params.teacherId;
    await withDbWrite(db => {
      const t = findTeacher(db, id);
      if (!t) {
        const err = new Error("Teacher not found");
        err.status = 404;
        throw err;
      }
      const used = db.subjects.some(s => String(s.teacherId) === String(id));
      if (used) {
        const err = new Error("Cannot delete teacher: teacher assigned to subjects");
        err.status = 409;
        throw err;
      }
      db.teachers = db.teachers.filter(x => String(x.teacherId) !== String(id));
    });
    res.json({ ok: true });
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// --------------------- Courses ---------------------
app.get("/api/courses", (req, res) => {
  const db = loadDb();
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const from = String(req.query.from ?? "").trim();
  const to = String(req.query.to ?? "").trim();

  let items = db.courses;

  if (q) items = items.filter(c => String(c.name ?? "").toLowerCase().includes(q));
  if (from) items = items.filter(c => String(c.startDate) >= from);
  if (to) items = items.filter(c => String(c.endDate) <= to);

  res.json(items.map(c => enrichCourse(db, c)));
});

app.get("/api/courses/:courseId", (req, res) => {
  const db = loadDb();
  const c = findCourse(db, req.params.courseId);
  if (!c) return httpError(res, 404, "Course not found");
  res.json(enrichCourse(db, c));
});

app.post("/api/courses", async (req, res) => {
  try {
    const p = req.body ?? {};

    const name = String(p.name ?? "").trim();
    const price = parseMoney(p.price);
    const maxResidents = parsePositiveInt(p.maxResidents);
    const startDate = String(p.startDate ?? "").trim();
    const endDate = String(p.endDate ?? "").trim();

    if (!isNonEmptyString(name)) return httpError(res, 400, "name is required");
    if (price == null || price < 0) return httpError(res, 400, "price must be >= 0");
    if (maxResidents == null) return httpError(res, 400, "maxResidents must be integer > 0");
    if (!isIsoDate(startDate)) return httpError(res, 400, "startDate is required (YYYY-MM-DD)");
    if (!isIsoDate(endDate)) return httpError(res, 400, "endDate is required (YYYY-MM-DD)");
    if (startDate > endDate) return httpError(res, 400, "startDate must be <= endDate");

    const created = await withDbWrite(db => {
      const dup = db.courses.some(c => String(c.name ?? "").toLowerCase() === name.toLowerCase());
      if (dup) {
        const err = new Error("Course name already exists");
        err.status = 409;
        throw err;
      }

      const course = {
        courseId: nextId(db, "courseId"),
        name,
        price,
        maxResidents,
        startDate,
        endDate
      };
      db.courses.push(course);
      return course;
    });

    res.status(201).json(created);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.put("/api/courses/:courseId", async (req, res) => {
  try {
    const id = req.params.courseId;
    const p = req.body ?? {};

    const updated = await withDbWrite(db => {
      const idx = db.courses.findIndex(c => String(c.courseId) === String(id));
      if (idx < 0) {
        const err = new Error("Course not found");
        err.status = 404;
        throw err;
      }

      const current = db.courses[idx];
      const next = { ...current };

      if (p.name != null) next.name = String(p.name).trim();
      if (p.price != null) next.price = parseMoney(p.price);
      if (p.maxResidents != null) next.maxResidents = parsePositiveInt(p.maxResidents);
      if (p.startDate != null) next.startDate = String(p.startDate).trim();
      if (p.endDate != null) next.endDate = String(p.endDate).trim();

      if (!isNonEmptyString(next.name)) {
        const err = new Error("name is required");
        err.status = 400;
        throw err;
      }
      if (next.price == null || next.price < 0) {
        const err = new Error("price must be >= 0");
        err.status = 400;
        throw err;
      }
      if (next.maxResidents == null) {
        const err = new Error("maxResidents must be integer > 0");
        err.status = 400;
        throw err;
      }
      if (!isIsoDate(next.startDate) || !isIsoDate(next.endDate)) {
        const err = new Error("startDate/endDate must be YYYY-MM-DD");
        err.status = 400;
        throw err;
      }
      if (next.startDate > next.endDate) {
        const err = new Error("startDate must be <= endDate");
        err.status = 400;
        throw err;
      }

      const dup = db.courses.some(c => String(c.courseId) !== String(id) && String(c.name ?? "").toLowerCase() === next.name.toLowerCase());
      if (dup) {
        const err = new Error("Course name already exists");
        err.status = 409;
        throw err;
      }

      db.courses[idx] = next;
      return next;
    });

    res.json(updated);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.delete("/api/courses/:courseId", async (req, res) => {
  try {
    const id = req.params.courseId;
    await withDbWrite(db => {
      const c = findCourse(db, id);
      if (!c) {
        const err = new Error("Course not found");
        err.status = 404;
        throw err;
      }
      const hasSubjects = db.subjects.some(s => String(s.courseId) === String(id));
      const hasEnrollments = db.enrollments.some(e => String(e.courseId) === String(id));
      if (hasSubjects || hasEnrollments) {
        const err = new Error("Cannot delete course: course has subjects/enrollments");
        err.status = 409;
        throw err;
      }
      db.courses = db.courses.filter(x => String(x.courseId) !== String(id));
    });
    res.json({ ok: true });
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// --------------------- Subjects ---------------------
app.get("/api/subjects", (req, res) => {
  const db = loadDb();
  const courseId = String(req.query.courseId ?? "").trim();

  let items = db.subjects;
  if (courseId) items = items.filter(s => String(s.courseId) === String(courseId));

  res.json(items);
});

app.get("/api/subjects/:subjectId", (req, res) => {
  const db = loadDb();
  const s = db.subjects.find(x => String(x.subjectId) === String(req.params.subjectId));
  if (!s) return httpError(res, 404, "Subject not found");
  res.json(s);
});

app.post("/api/subjects", async (req, res) => {
  try {
    const p = req.body ?? {};

    const courseId = p.courseId;
    const teacherId = p.teacherId;
    const name = String(p.name ?? "").trim();
    const hours = parsePositiveInt(p.hours) ?? parsePositiveNumber(p.hours); // allow int/number

    if (courseId == null) return httpError(res, 400, "courseId is required");
    if (teacherId == null) return httpError(res, 400, "teacherId is required");
    if (!isNonEmptyString(name)) return httpError(res, 400, "name is required");
    if (hours == null || Number(hours) <= 0) return httpError(res, 400, "hours must be > 0");

    const created = await withDbWrite(db => {
      if (!findCourse(db, courseId)) {
        const err = new Error("Course not found");
        err.status = 404;
        throw err;
      }
      if (!findTeacher(db, teacherId)) {
        const err = new Error("Teacher not found");
        err.status = 404;
        throw err;
      }

      const dup = db.subjects.some(s =>
        String(s.courseId) === String(courseId) &&
        String(s.name ?? "").toLowerCase() === name.toLowerCase()
      );
      if (dup) {
        const err = new Error("Duplicate subject name in this course");
        err.status = 409;
        throw err;
      }

      const subject = {
        subjectId: nextId(db, "subjectId"),
        courseId,
        name,
        hours: Number(hours),
        teacherId
      };
      db.subjects.push(subject);
      return subject;
    });

    res.status(201).json(created);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.put("/api/subjects/:subjectId", async (req, res) => {
  try {
    const id = req.params.subjectId;
    const p = req.body ?? {};

    const updated = await withDbWrite(db => {
      const idx = db.subjects.findIndex(s => String(s.subjectId) === String(id));
      if (idx < 0) {
        const err = new Error("Subject not found");
        err.status = 404;
        throw err;
      }

      const current = db.subjects[idx];
      const next = { ...current };

      if (p.courseId != null) next.courseId = p.courseId;
      if (p.teacherId != null) next.teacherId = p.teacherId;
      if (p.name != null) next.name = String(p.name).trim();
      if (p.hours != null) next.hours = Number(p.hours);

      if (next.courseId == null || !findCourse(db, next.courseId)) {
        const err = new Error("Course not found");
        err.status = 404;
        throw err;
      }
      if (next.teacherId == null || !findTeacher(db, next.teacherId)) {
        const err = new Error("Teacher not found");
        err.status = 404;
        throw err;
      }
      if (!isNonEmptyString(next.name)) {
        const err = new Error("name is required");
        err.status = 400;
        throw err;
      }
      if (!Number.isFinite(Number(next.hours)) || Number(next.hours) <= 0) {
        const err = new Error("hours must be > 0");
        err.status = 400;
        throw err;
      }

      const dup = db.subjects.some(s =>
        String(s.subjectId) !== String(id) &&
        String(s.courseId) === String(next.courseId) &&
        String(s.name ?? "").toLowerCase() === next.name.toLowerCase()
      );
      if (dup) {
        const err = new Error("Duplicate subject name in this course");
        err.status = 409;
        throw err;
      }

      db.subjects[idx] = next;
      return next;
    });

    res.json(updated);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.delete("/api/subjects/:subjectId", async (req, res) => {
  try {
    const id = req.params.subjectId;
    await withDbWrite(db => {
      const s = db.subjects.find(x => String(x.subjectId) === String(id));
      if (!s) {
        const err = new Error("Subject not found");
        err.status = 404;
        throw err;
      }
      db.subjects = db.subjects.filter(x => String(x.subjectId) !== String(id));
    });
    res.json({ ok: true });
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// --------------------- Enrollments (T2) ---------------------
app.get("/api/enrollments", (req, res) => {
  const db = loadDb();
  const courseId = String(req.query.courseId ?? "").trim();
  const residentDni = String(req.query.residentDni ?? "").trim();

  let items = db.enrollments;
  if (courseId) items = items.filter(e => String(e.courseId) === String(courseId));
  if (residentDni) items = items.filter(e => e.residentDni === residentDni);

  res.json(items);
});

app.post("/api/enrollments", async (req, res) => {
  try {
    const p = req.body ?? {};
    const residentDni = String(p.residentDni ?? "").trim();
    const courseId = p.courseId;
    const enrollmentDate = String(p.enrollmentDate ?? "").trim();

    if (!isNonEmptyString(residentDni)) return httpError(res, 400, "residentDni is required");
    if (courseId == null) return httpError(res, 400, "courseId is required");
    if (!isIsoDate(enrollmentDate)) return httpError(res, 400, "enrollmentDate is required (YYYY-MM-DD)");

    const created = await withDbWrite(db => {
      // T2 — EnrollResidentInCourse atomic
      if (!findResident(db, residentDni)) {
        const err = new Error("Resident not found");
        err.status = 404;
        throw err;
      }
      const course = findCourse(db, courseId);
      if (!course) {
        const err = new Error("Course not found");
        err.status = 404;
        throw err;
      }

      const dup = db.enrollments.some(e =>
        e.residentDni === residentDni && String(e.courseId) === String(courseId)
      );
      if (dup) {
        const err = new Error("Resident is already enrolled in this course");
        err.status = 409;
        throw err;
      }

      const enrolledCount = courseEnrolledCount(db, courseId);
      if (enrolledCount >= Number(course.maxResidents)) {
        const err = new Error("Course is full. Max residents reached.");
        err.status = 409;
        throw err;
      }

      const enrollment = {
        enrollmentId: nextId(db, "enrollmentId"),
        residentDni,
        courseId,
        enrollmentDate
      };

      db.enrollments.push(enrollment);
      return enrollment;
    });

    res.status(201).json(created);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

app.delete("/api/enrollments/:enrollmentId", async (req, res) => {
  try {
    const id = req.params.enrollmentId;
    await withDbWrite(db => {
      const e = db.enrollments.find(x => String(x.enrollmentId) === String(id));
      if (!e) {
        const err = new Error("Enrollment not found");
        err.status = 404;
        throw err;
      }
      db.enrollments = db.enrollments.filter(x => String(x.enrollmentId) !== String(id));
    });
    res.json({ ok: true });
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// --------------------- Convenience endpoints ---------------------
app.get("/api/courses/:courseId/summary", (req, res) => {
  const db = loadDb();
  const course = findCourse(db, req.params.courseId);
  if (!course) return httpError(res, 404, "Course not found");

  const durationHours = courseDurationHours(db, course.courseId);
  const enrolledCount = courseEnrolledCount(db, course.courseId);
  const hasCapacity = enrolledCount < Number(course.maxResidents);

  res.json({ courseId: course.courseId, durationHours, enrolledCount, hasCapacity });
});

app.get("/api/courses/:courseId/enrolled-residents", (req, res) => {
  const db = loadDb();
  const course = findCourse(db, req.params.courseId);
  if (!course) return httpError(res, 404, "Course not found");

  const enrolls = db.enrollments.filter(e => String(e.courseId) === String(course.courseId));
  const residents = enrolls
    .map(e => {
      const r = db.residents.find(x => x.dni === e.residentDni);
      return r ? { ...r, enrollmentId: e.enrollmentId, enrollmentDate: e.enrollmentDate } : null;
    })
    .filter(Boolean);

  res.json(residents);
});

app.get("/api/residents/:dni/enrolled-courses", (req, res) => {
  const db = loadDb();
  const dni = req.params.dni;
  if (!findResident(db, dni)) return httpError(res, 404, "Resident not found");

  const enrolls = db.enrollments.filter(e => e.residentDni === dni);
  const courses = enrolls
    .map(e => {
      const c = findCourse(db, e.courseId);
      if (!c) return null;
      return { ...enrichCourse(db, c), enrollmentId: e.enrollmentId, enrollmentDate: e.enrollmentDate };
    })
    .filter(Boolean);

  res.json(courses);
});

// ---------- Start ----------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SIGCO backend running on http://localhost:${PORT}`);
});
