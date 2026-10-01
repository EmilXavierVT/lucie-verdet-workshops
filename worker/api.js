const HTML = __HTML__;
const ADMIN_HTML = __ADMIN_HTML__;
const CSS = __CSS__;
const CLIENT_JS = __CLIENT_JS__;
const ADMIN_JS = __ADMIN_JS__;

const workshops = [
  { id: "2026-10-08", label: "Torsdag d. 8. oktober, kl. 17-20", date: "2026-10-08", day: "Torsdag", time: "17-20", capacity: 7 },
  { id: "2026-10-11", label: "Søndag d. 11. oktober, kl. 13-16", date: "2026-10-11", day: "Søndag", time: "13-16", capacity: 7 },
  { id: "2026-10-20", label: "Tirsdag d. 20. oktober, kl. 17-20", date: "2026-10-20", day: "Tirsdag", time: "17-20", capacity: 7 },
  { id: "2026-11-05", label: "Torsdag d. 5. november, kl. 17-20", date: "2026-11-05", day: "Torsdag", time: "17-20", capacity: 7 },
  { id: "2026-11-08", label: "Søndag d. 8. november, kl. 13-16", date: "2026-11-08", day: "Søndag", time: "13-16", capacity: 7 },
  { id: "2026-11-17", label: "Tirsdag d. 17. november, kl. 17-20", date: "2026-11-17", day: "Tirsdag", time: "17-20", capacity: 7 },
  { id: "2026-12-03", label: "Torsdag d. 3. december, kl. 17-20", date: "2026-12-03", day: "Torsdag", time: "17-20", capacity: 7 },
  { id: "2026-12-06", label: "Søndag d. 6. december, kl. 13-16", date: "2026-12-06", day: "Søndag", time: "13-16", capacity: 7 },
  { id: "2026-12-08", label: "Tirsdag d. 8. december, kl. 17-20", date: "2026-12-08", day: "Tirsdag", time: "17-20", capacity: 7 }
];

const headers = {
  html: { "content-type": "text/html; charset=utf-8" },
  css: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=60" },
  js: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=60" },
  json: { "content-type": "application/json; charset=utf-8" }
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...headers.json, ...(init.headers || {}) }
  });
}

function unauthorized() {
  return new Response("Admin login required", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="Lucie Verdet admin", charset="UTF-8"',
      "cache-control": "no-store"
    }
  });
}

function decodeBasicAuth(header) {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ""));
  const right = new TextEncoder().encode(String(b || ""));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] || 0) ^ (right[index] || 0);
  }
  return diff === 0;
}

function isAdminRequest(url) {
  return url.pathname === "/admin" || url.pathname === "/admin.js" || url.pathname.startsWith("/api/admin");
}

function requireAdmin(request, env) {
  const expectedUser = env.ADMIN_USER;
  const expectedPassword = env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) return unauthorized();

  const credentials = decodeBasicAuth(request.headers.get("authorization"));
  if (
    !credentials ||
    !timingSafeEqual(credentials.username, expectedUser) ||
    !timingSafeEqual(credentials.password, expectedPassword)
  ) {
    return unauthorized();
  }

  return null;
}

async function readReservedSeats(db) {
  const result = await db
    .prepare(
      `SELECT class_id, COALESCE(SUM(seats), 0) AS booked
       FROM workshop_bookings
       WHERE status IN ('reserved', 'confirmed')
       GROUP BY class_id`
    )
    .all();

  return new Map((result.results || []).map((row) => [row.class_id, Number(row.booked || 0)]));
}

async function readSettings(db) {
  const result = await db
    .prepare(
      `SELECT class_id, capacity, is_open, note
       FROM workshop_settings`
    )
    .all();

  return new Map((result.results || []).map((row) => [row.class_id, row]));
}

function applySettings(workshop, settings) {
  const setting = settings.get(workshop.id);
  const capacity = setting ? Number(setting.capacity) : workshop.capacity;
  return {
    ...workshop,
    capacity,
    isOpen: setting ? Boolean(setting.is_open) : true,
    note: setting?.note || ""
  };
}

async function availability(env) {
  if (!env.DB) throw new Error("Database binding is unavailable");
  const reserved = await readReservedSeats(env.DB);
  const settings = await readSettings(env.DB);
  return workshops.map((baseWorkshop) => {
    const workshop = applySettings(baseWorkshop, settings);
    const booked = reserved.get(workshop.id) || 0;
    const seatsLeft = workshop.isOpen ? Math.max(0, workshop.capacity - booked) : 0;
    return {
      ...workshop,
      booked,
      seatsLeft,
      status: !workshop.isOpen ? "closed" : seatsLeft === 0 ? "full" : seatsLeft <= 2 ? "low" : "open"
    };
  });
}

function cleanText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

async function createBooking(request, env) {
  if (!env.DB) return json({ error: "Bookings are temporarily unavailable." }, { status: 503 });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Please check the booking details and try again." }, { status: 400 });
  }

  const classes = await availability(env);
  const workshop = classes.find((item) => item.id === payload.classId);
  const seats = Number(payload.seats || 0);
  if (!workshop || !workshop.isOpen || !Number.isInteger(seats) || seats < 1 || seats > workshop.capacity) {
    return json({ error: "Please choose a valid workshop and seat count." }, { status: 400 });
  }

  const guest = {
    name: cleanText(payload.name, 120),
    email: cleanText(payload.email, 180),
    phone: cleanText(payload.phone, 80),
    experience: cleanText(payload.experience, 80),
    notes: cleanText(payload.notes, 800)
  };

  if (!guest.name || !guest.email || !guest.email.includes("@")) {
    return json({ error: "Please add a name and valid email." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const bookingDocument = {
    id,
    workshop: {
      id: workshop.id,
      label: workshop.label,
      date: workshop.date,
      time: workshop.time
    },
    seats,
    guest,
    source: "website-calendar"
  };

  const inserted = await env.DB
    .prepare(
      `INSERT INTO workshop_bookings (id, class_id, seats, booking_json, status)
       SELECT ?, ?, ?, ?, 'reserved'
       WHERE ? <= (
         ? - COALESCE((
           SELECT SUM(seats)
           FROM workshop_bookings
           WHERE class_id = ? AND status IN ('reserved', 'confirmed')
         ), 0)
       )`
    )
    .bind(id, workshop.id, seats, JSON.stringify(bookingDocument), seats, workshop.capacity, workshop.id)
    .run();

  if (!inserted.meta || inserted.meta.changes !== 1) {
    const currentClasses = await availability(env);
    const current = currentClasses.find((item) => item.id === workshop.id);
    return json(
      {
        error: "That workshop no longer has enough seats. Please choose another date.",
        workshop: current
      },
      { status: 409 }
    );
  }

  const updatedClasses = await availability(env);
  return json({
    booking: { id, classId: workshop.id, classLabel: workshop.label, seats, guest },
    workshops: updatedClasses
  });
}

function parseBooking(row) {
  let document = {};
  try {
    document = JSON.parse(row.booking_json || "{}");
  } catch {
    document = {};
  }

  return {
    id: row.id,
    classId: row.class_id,
    seats: Number(row.seats || 0),
    status: row.status,
    createdAt: row.created_at,
    workshop: document.workshop || workshops.find((item) => item.id === row.class_id) || { id: row.class_id },
    guest: document.guest || {}
  };
}

async function adminState(env) {
  if (!env.DB) throw new Error("Database binding is unavailable");
  const classes = await availability(env);
  const bookingRows = await env.DB
    .prepare(
      `SELECT id, class_id, seats, booking_json, status, created_at
       FROM workshop_bookings
       ORDER BY created_at DESC`
    )
    .all();

  return {
    workshops: classes,
    bookings: (bookingRows.results || []).map(parseBooking)
  };
}

async function updateWorkshop(request, env, classId) {
  const baseWorkshop = workshops.find((item) => item.id === classId);
  if (!baseWorkshop) return json({ error: "Unknown workshop date." }, { status: 404 });

  const payload = await request.json();
  const capacity = Number(payload.capacity);
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 30) {
    return json({ error: "Capacity must be between 0 and 30." }, { status: 400 });
  }

  await env.DB
    .prepare(
      `INSERT INTO workshop_settings (class_id, capacity, is_open, note, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(class_id) DO UPDATE SET
         capacity = excluded.capacity,
         is_open = excluded.is_open,
         note = excluded.note,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(classId, capacity, payload.isOpen ? 1 : 0, cleanText(payload.note, 300))
    .run();

  return json(await adminState(env));
}

async function updateBooking(request, env, bookingId) {
  const payload = await request.json();
  const allowed = new Set(["reserved", "confirmed", "cancelled"]);
  if (!allowed.has(payload.status)) {
    return json({ error: "Choose reserved, confirmed, or cancelled." }, { status: 400 });
  }

  const result = await env.DB
    .prepare(
      `UPDATE workshop_bookings
       SET status = ?
       WHERE id = ?`
    )
    .bind(payload.status, bookingId)
    .run();

  if (!result.meta || result.meta.changes !== 1) {
    return json({ error: "Booking was not found." }, { status: 404 });
  }

  return json(await adminState(env));
}

export default {
  async fetch(request, env, ctx) {
    void ctx;
    const url = new URL(request.url);

    try {
      if (isAdminRequest(url)) {
        const denied = requireAdmin(request, env);
        if (denied) return denied;
      }

      if (request.method === "GET" && url.pathname === "/") return new Response(HTML, { headers: headers.html });
      if (request.method === "GET" && url.pathname === "/admin") return new Response(ADMIN_HTML, { headers: headers.html });
      if (request.method === "GET" && url.pathname === "/styles.css") return new Response(CSS, { headers: headers.css });
      if (request.method === "GET" && url.pathname === "/script.js") return new Response(CLIENT_JS, { headers: headers.js });
      if (request.method === "GET" && url.pathname === "/admin.js") return new Response(ADMIN_JS, { headers: headers.js });
      if (request.method === "GET" && url.pathname === "/api/availability") return json({ workshops: await availability(env) });
      if (request.method === "POST" && url.pathname === "/api/bookings") return createBooking(request, env);
      if (request.method === "GET" && url.pathname === "/api/admin") return json(await adminState(env));
      if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/workshops/")) {
        return updateWorkshop(request, env, decodeURIComponent(url.pathname.replace("/api/admin/workshops/", "")));
      }
      if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/bookings/")) {
        return updateBooking(request, env, decodeURIComponent(url.pathname.replace("/api/admin/bookings/", "")));
      }
    } catch (error) {
      console.error(error);
      return json({ error: "The booking system is temporarily unavailable. Please email Lucie directly." }, { status: 500 });
    }

    return new Response("Not found", { status: 404 });
  }
};
