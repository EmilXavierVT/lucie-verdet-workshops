const workshopAdminList = document.querySelector("#workshopAdminList");
const bookingAdminList = document.querySelector("#bookingAdminList");
const adminSummary = document.querySelector("#adminSummary");
const bookingStatus = document.querySelector("#bookingStatus");

let adminState = { workshops: [], bookings: [] };

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function statusLabel(status) {
  return status ? status[0].toUpperCase() + status.slice(1) : "Reserved";
}

function formatGuest(booking) {
  const guest = booking.guest || {};
  return [guest.name, guest.email, guest.phone].filter(Boolean).join(" · ");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Admin action failed");
  return data;
}

function renderSummary() {
  const activeBookings = adminState.bookings.filter((booking) => ["reserved", "confirmed"].includes(booking.status));
  const seats = activeBookings.reduce((total, booking) => total + Number(booking.seats || 0), 0);
  const openWorkshops = adminState.workshops.filter((workshop) => workshop.isOpen).length;
  adminSummary.innerHTML = `
    <strong>${openWorkshops}</strong><span>open dates</span>
    <strong>${activeBookings.length}</strong><span>active bookings</span>
    <strong>${seats}</strong><span>reserved seats</span>
  `;
}

function renderWorkshops() {
  workshopAdminList.innerHTML = adminState.workshops.map((workshop) => `
    <article class="admin-card" data-workshop-id="${workshop.id}">
      <div>
        <h3>${escapeHtml(workshop.label)}</h3>
        <p>${workshop.booked} booked · ${workshop.seatsLeft} available</p>
      </div>
      <div class="admin-controls">
        <label>
          Capacity
          <input class="capacity-input" type="number" min="0" max="30" value="${workshop.capacity}">
        </label>
        <label class="switch-row">
          <input class="open-input" type="checkbox" ${workshop.isOpen ? "checked" : ""}>
          Open
        </label>
        <label>
          Note
          <input class="note-input" value="${escapeHtml(workshop.note)}" placeholder="Optional internal note">
        </label>
        <button class="button primary save-workshop" type="button">Save</button>
      </div>
    </article>
  `).join("");
}

function renderBookings() {
  const filter = bookingStatus.value;
  const bookings = adminState.bookings.filter((booking) => {
    if (filter === "all") return true;
    if (filter === "active") return ["reserved", "confirmed"].includes(booking.status);
    return booking.status === filter;
  });

  if (!bookings.length) {
    bookingAdminList.innerHTML = `<div class="empty-state">No bookings in this view.</div>`;
    return;
  }

  bookingAdminList.innerHTML = bookings.map((booking) => `
    <article class="admin-card booking-row" data-booking-id="${booking.id}">
      <div>
        <h3>${escapeHtml(booking.workshop?.label || booking.classId)}</h3>
        <p>${booking.seats} ${booking.seats === 1 ? "seat" : "seats"} · ${escapeHtml(formatGuest(booking))}</p>
        ${booking.guest?.notes ? `<p class="booking-note">${escapeHtml(booking.guest.notes)}</p>` : ""}
      </div>
      <div class="admin-controls compact">
        <span class="status-pill ${booking.status}">${statusLabel(booking.status)}</span>
        <button class="button ghost booking-status" type="button" data-status="confirmed">Confirm</button>
        <button class="button ghost booking-status" type="button" data-status="reserved">Reserve</button>
        <button class="button ghost booking-status" type="button" data-status="cancelled">Cancel</button>
      </div>
    </article>
  `).join("");
}

function render() {
  renderSummary();
  renderWorkshops();
  renderBookings();
}

async function loadAdmin() {
  adminSummary.textContent = "Loading admin data...";
  adminState = await api("/api/admin");
  render();
}

workshopAdminList.addEventListener("click", async (event) => {
  const button = event.target.closest(".save-workshop");
  if (!button) return;

  const card = button.closest("[data-workshop-id]");
  const id = card.dataset.workshopId;
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const capacity = Number(card.querySelector(".capacity-input").value);
    const isOpen = card.querySelector(".open-input").checked;
    const note = card.querySelector(".note-input").value;
    adminState = await api(`/api/admin/workshops/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ capacity, isOpen, note })
    });
    render();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Save";
  }
});

bookingAdminList.addEventListener("click", async (event) => {
  const button = event.target.closest(".booking-status");
  if (!button) return;

  const card = button.closest("[data-booking-id]");
  const id = card.dataset.bookingId;
  button.disabled = true;

  try {
    adminState = await api(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: button.dataset.status })
    });
    render();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
});

bookingStatus.addEventListener("change", renderBookings);

loadAdmin().catch((error) => {
  adminSummary.textContent = error.message || "Admin data could not load.";
});
