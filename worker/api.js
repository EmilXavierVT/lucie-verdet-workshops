const HTML = __HTML__;
const CSS = __CSS__;
const CLIENT_JS = __CLIENT_JS__;

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

async function readReservedSeats(db) {
  const result = await db
    .prepare(
      `SELECT class_id, COALESCE(SUM(seats), 0) AS booked
       FROM workshop_bookings
       WHERE status = 'reserved'
       GROUP BY class_id`
    )
    .all();

  return new Map((result.results || []).map((row) => [row.class_id, Number(row.booked || 0)]));
}

async function availability(env) {
  if (!env.DB) throw new Error("Database binding is unavailable");
  const reserved = await readReservedSeats(env.DB);
  return workshops.map((workshop) => {
    const booked = reserved.get(workshop.id) || 0;
    const seatsLeft = Math.max(0, workshop.capacity - booked);
    return { ...workshop, booked, seatsLeft, status: seatsLeft === 0 ? "full" : seatsLeft <= 2 ? "low" : "open" };
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

  const workshop = workshops.find((item) => item.id === payload.classId);
  const seats = Number(payload.seats || 0);
  if (!workshop || !Number.isInteger(seats) || seats < 1 || seats > workshop.capacity) {
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
           WHERE class_id = ? AND status = 'reserved'
         ), 0)
       )`
    )
    .bind(id, workshop.id, seats, JSON.stringify(bookingDocument), seats, workshop.capacity, workshop.id)
    .run();

  if (!inserted.meta || inserted.meta.changes !== 1) {
    const classes = await availability(env);
    const current = classes.find((item) => item.id === workshop.id);
    return json(
      {
        error: "That workshop no longer has enough seats. Please choose another date.",
        workshop: current
      },
      { status: 409 }
    );
  }

  const classes = await availability(env);
  return json({
    booking: { id, classId: workshop.id, classLabel: workshop.label, seats, guest },
    workshops: classes
  });
}

export default {
  async fetch(request, env, ctx) {
    void ctx;
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/") return new Response(HTML, { headers: headers.html });
      if (request.method === "GET" && url.pathname === "/styles.css") return new Response(CSS, { headers: headers.css });
      if (request.method === "GET" && url.pathname === "/script.js") return new Response(CLIENT_JS, { headers: headers.js });
      if (request.method === "GET" && url.pathname === "/api/availability") return json({ workshops: await availability(env) });
      if (request.method === "POST" && url.pathname === "/api/bookings") return createBooking(request, env);
    } catch (error) {
      console.error(error);
      return json({ error: "The booking system is temporarily unavailable. Please email Lucie directly." }, { status: 500 });
    }

    return new Response("Not found", { status: 404 });
  }
};
