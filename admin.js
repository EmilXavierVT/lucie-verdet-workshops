const adminCalendarGrid = document.querySelector("#adminCalendarGrid");
const adminCalendarMonth = document.querySelector("#adminCalendarMonth");
const adminPreviousMonth = document.querySelector("#adminPreviousMonth");
const adminNextMonth = document.querySelector("#adminNextMonth");
const bookingAdminList = document.querySelector("#bookingAdminList");
const adminSummary = document.querySelector("#adminSummary");
const bookingStatus = document.querySelector("#bookingStatus");
const workshopEditor = document.querySelector("#workshopEditor");
const selectedWorkshopTitle = document.querySelector("#selectedWorkshopTitle");
const selectedWorkshopMeta = document.querySelector("#selectedWorkshopMeta");
const selectedWorkshopField = document.querySelector("#selectedWorkshopId");
const selectedCapacity = document.querySelector("#selectedCapacity");
const selectedOpen = document.querySelector("#selectedOpen");
const selectedNote = document.querySelector("#selectedNote");
const saveSelectedWorkshop = document.querySelector("#saveSelectedWorkshop");

let adminState = { workshops: [], bookings: [] };
let activeWorkshopId = "";
let visibleMonth = "2026-10";

const monthNames = new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" });
const weekdayLabels = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

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

function activeWorkshop() {
  return adminState.workshops.find((workshop) => workshop.id === activeWorkshopId);
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
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
  const closedWorkshops = adminState.workshops.length - openWorkshops;
  adminSummary.innerHTML = `
    <div><strong>${openWorkshops}</strong><span>open dates</span></div>
    <div><strong>${closedWorkshops}</strong><span>closed dates</span></div>
    <div><strong>${activeBookings.length}</strong><span>active bookings</span></div>
    <div><strong>${seats}</strong><span>reserved seats</span></div>
  `;
}

function renderAdminCalendar() {
  adminCalendarGrid.innerHTML = "";
  weekdayLabels.forEach((label) => {
    const weekday = document.createElement("div");
    weekday.className = "calendar-weekday";
    weekday.textContent = label;
    adminCalendarGrid.append(weekday);
  });

  const [year, month] = visibleMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const byDate = new Map(adminState.workshops.filter((item) => item.date.startsWith(visibleMonth)).map((item) => [item.date, item]));

  adminCalendarMonth.textContent = monthNames.format(first);

  for (let i = 0; i < offset; i += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar-day admin-empty-day";
    adminCalendarGrid.append(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${visibleMonth}-${String(day).padStart(2, "0")}`;
    const workshop = byDate.get(date);

    if (!workshop) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "calendar-day admin-empty-day";
      emptyDay.innerHTML = `<span class="day-number">${day}</span>`;
      adminCalendarGrid.append(emptyDay);
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-day has-workshop admin-workshop-day ${workshop.status}`;
    if (workshop.id === activeWorkshopId) button.classList.add("selected");
    button.setAttribute("aria-pressed", workshop.id === activeWorkshopId ? "true" : "false");
    button.innerHTML = `
      <span class="day-number">${day}</span>
      <span class="day-time">${workshop.time}</span>
      <span class="day-seats ${workshop.status === "low" ? "low" : ""}">${workshop.isOpen ? `${workshop.seatsLeft}/${workshop.capacity} free` : "Closed"}</span>
      <span class="admin-booked-count">${workshop.booked} booked</span>
    `;
    button.addEventListener("click", () => {
      activeWorkshopId = workshop.id;
      renderAdminCalendar();
      renderWorkshopEditor();
    });
    adminCalendarGrid.append(button);
  }
}

function renderWorkshopEditor() {
  const workshop = activeWorkshop();
  const disabled = !workshop;

  selectedCapacity.disabled = disabled;
  selectedOpen.disabled = disabled;
  selectedNote.disabled = disabled;
  saveSelectedWorkshop.disabled = disabled;

  if (!workshop) {
    selectedWorkshopTitle.textContent = "Choose a workshop";
    selectedWorkshopMeta.textContent = "Select a date in the calendar to edit seats and visibility.";
    selectedWorkshopField.value = "";
    selectedCapacity.value = 7;
    selectedOpen.checked = false;
    selectedNote.value = "";
    return;
  }

  selectedWorkshopTitle.textContent = workshop.label;
  selectedWorkshopMeta.textContent = `${workshop.booked} booked · ${workshop.seatsLeft} available · ${workshop.isOpen ? "open" : "closed"}`;
  selectedWorkshopField.value = workshop.id;
  selectedCapacity.value = workshop.capacity;
  selectedOpen.checked = workshop.isOpen;
  selectedNote.value = workshop.note || "";
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
  if (!activeWorkshopId) {
    const firstOpen = adminState.workshops.find((workshop) => workshop.isOpen) || adminState.workshops[0];
    activeWorkshopId = firstOpen ? firstOpen.id : "";
    if (firstOpen) visibleMonth = firstOpen.date.slice(0, 7);
  }

  renderSummary();
  renderAdminCalendar();
  renderWorkshopEditor();
  renderBookings();
}

async function loadAdmin() {
  adminSummary.textContent = "Loading admin data...";
  adminState = await api("/api/admin");
  render();
}

function updateMonth(delta) {
  const [year, month] = visibleMonth.split("-").map(Number);
  visibleMonth = monthKey(new Date(Date.UTC(year, month - 1 + delta, 1)));
  renderAdminCalendar();
}

workshopEditor.addEventListener("submit", async (event) => {
  event.preventDefault();
  const workshop = activeWorkshop();
  if (!workshop) return;

  saveSelectedWorkshop.disabled = true;
  saveSelectedWorkshop.textContent = "Saving...";

  try {
    adminState = await api(`/api/admin/workshops/${workshop.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        capacity: Number(selectedCapacity.value),
        isOpen: selectedOpen.checked,
        note: selectedNote.value
      })
    });
    render();
  } catch (error) {
    alert(error.message);
  } finally {
    saveSelectedWorkshop.disabled = false;
    saveSelectedWorkshop.textContent = "Save availability";
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

adminPreviousMonth.addEventListener("click", () => updateMonth(-1));
adminNextMonth.addEventListener("click", () => updateMonth(1));
bookingStatus.addEventListener("change", renderBookings);

loadAdmin().catch((error) => {
  adminSummary.textContent = error.message || "Admin data could not load.";
});
