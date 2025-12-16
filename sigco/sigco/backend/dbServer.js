const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "db.json");

// ---------- Persistence helpers (atomic write) ----------
function ensureDbShape(db) {
  return {
    residents: Array.isArray(db?.residents) ? db.residents : [],
    managers: Array.isArray(db?.managers) ? db.managers : [],
    visits: Array.isArray(db?.visits) ? db.visits : [],
    invoices: Array.isArray(db?.invoices) ? db.invoices : [],
    counters: {
      visitId: Number(db?.counters?.visitId ?? 1000),
      invoiceId: Number(db?.counters?.invoiceId ?? 5000),
      managerId: Number(db?.counters?.managerId ?? 0)
    }
  };
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

function saveDbAtomic(db) {
  const tmp = DB_PATH + ".tmp";
  const content = JSON.stringify(db, null, 2);

  // 1) write temp
  fs.writeFileSync(tmp, content, "utf-8");

  // 2) overwrite db.json safely (copy temp over it)
  fs.copyFileSync(tmp, DB_PATH);

  // 3) cleanup temp (best-effort)
  try { fs.unlinkSync(tmp); } catch {}
}


// Serialize all writes to prevent double-billing in a single-node process.
let writeQueue = Promise.resolve();
function withDbWrite(fn) {
  writeQueue = writeQueue.then(() => {
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
  // store as number in EUR; you can switch to cents int later
  return Math.round(n * 100) / 100;
}

function httpError(res, status, message, details) {
  return res.status(status).json({ error: message, details });
}

// ---------- Domain integrity checks ----------
function residentExists(db, dni) {
  return db.residents.some(r => r.dni === dni);
}

function managerExists(db, managerId) {
  return db.managers.some(m => String(m.managerId) === String(managerId));
}

function invoiceExists(db, invoiceId) {
  return db.invoices.some(i => String(i.invoiceId) === String(invoiceId));
}

function unpaidVisitsOfResident(db, dni) {
  return db.visits.filter(v => v.residentDni === dni && v.invoiceId == null);
}

function computeResidentUnpaidStats(db, dni) {
  const unpaid = unpaidVisitsOfResident(db, dni);
  const count = unpaid.length;
  const total = unpaid.reduce((sum, v) => sum + Number(v.amount || 0), 0);
  return { hasUnpaidVisits: count > 0, unpaidVisitsCount: count, unpaidVisitsTotal: Math.round(total * 100) / 100 };
}

function enforceVisitPaidConsistency(visit) {
  // strict rule: PAID iff invoiceId != null
  const paid = visit.invoiceId != null;
  visit.status = paid ? "PAID" : "UNPAID";
  if (!paid) visit.invoiceId = null;
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

  // attach derived unpaid stats
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

      // DNI is immutable
      const allowed = ["firstName", "lastName", "address", "postalCode", "city", "phone"];
      for (const k of allowed) {
        if (payload[k] != null) next[k] = String(payload[k]).trim();
      }

      // validate required still present
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

// Convenience endpoint
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

  // sort by date desc
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

      // Editing rules: if PAID, only allow description changes
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

      // UNPAID: allow edits
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

      // keep unpaid invariant
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
      // T1 — CreateInvoiceAndSettleVisits atomic
      if (!residentExists(db, residentDni)) {
        const err = new Error("Resident not found");
        err.status = 404;
        throw err;
      }

      // re-fetch unpaid inside the transaction
      const unpaid = unpaidVisitsOfResident(db, residentDni);

      if (unpaid.length === 0) {
        const err = new Error("No unpaid visits for this resident");
        err.status = 409;
        throw err;
      }

      // extra integrity: ensure none already linked (should be true by filter)
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

      // settle visits
      db.visits = db.visits.map(v => {
        if (visitIds.some(id => String(id) === String(v.visitId))) {
          const updated = { ...v, invoiceId, status: "PAID" };
          enforceVisitPaidConsistency(updated);
          return updated;
        }
        return v;
      });

      // invariant check: every visit now points to existing invoice
      for (const vid of visitIds) {
        const vv = db.visits.find(v => String(v.visitId) === String(vid));
        if (!vv || String(vv.invoiceId) !== String(invoiceId)) {
          const err = new Error("Invariant failed while settling visits");
          err.status = 500;
          throw err;
        }
      }

      return newInvoice;
    });

    res.status(201).json(invoice);
  } catch (e) {
    return httpError(res, e.status || 500, e.message || "Server error");
  }
});

// ---------- Start ----------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SIGCO backend running on http://localhost:${PORT}`);
});
