const form = document.querySelector("#bookingForm");
const classDate = document.querySelector("#classDate");
const seats = document.querySelector("#seats");
const availability = document.querySelector("#availability");
const confirmation = document.querySelector("#confirmation");
const calendarGrid = document.querySelector("#calendarGrid");
const calendarMonth = document.querySelector("#calendarMonth");
const previousMonth = document.querySelector("#previousMonth");
const nextMonth = document.querySelector("#nextMonth");

let workshops = [];
let selectedClassId = "";
let visibleMonth = "2026-10";

const monthNames = new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" });
const weekdayLabels = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function selectedWorkshop() {
  return workshops.find((item) => item.id === selectedClassId);
}

function updateAvailability() {
  const workshop = selectedWorkshop();
  if (!workshop) {
    availability.className = "availability";
    availability.textContent = "Choose a workshop date in the calendar.";
    seats.max = 1;
    return;
  }

  const remaining = workshop.seatsLeft;
  seats.max = Math.max(1, remaining);
  if (Number(seats.value) > remaining) seats.value = Math.max(1, remaining);
  classDate.value = workshop.id;

  availability.className = "availability";
  if (!workshop.isOpen) {
    availability.classList.add("full");
    availability.textContent = "This workshop is currently closed for bookings.";
  } else if (remaining <= 0) {
    availability.classList.add("full");
    availability.textContent = "This workshop is fully booked. Choose another date or email Lucie for the waitlist.";
  } else if (remaining <= 2) {
    availability.classList.add("low");
    availability.textContent = `Only ${remaining} ${remaining === 1 ? "seat" : "seats"} left for this workshop.`;
  } else {
    availability.textContent = `${remaining} seats available. Small group, maximum ${workshop.capacity} guests.`;
  }
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  weekdayLabels.forEach((label) => {
    const weekday = document.createElement("div");
    weekday.className = "calendar-weekday";
    weekday.textContent = label;
    calendarGrid.append(weekday);
  });

  const [year, month] = visibleMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const byDate = new Map(workshops.filter((item) => item.date.startsWith(visibleMonth)).map((item) => [item.date, item]));

  calendarMonth.textContent = monthNames.format(first);

  for (let i = 0; i < offset; i += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar-day";
    calendarGrid.append(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${visibleMonth}-${String(day).padStart(2, "0")}`;
    const workshop = byDate.get(date);

    if (!workshop) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "calendar-day";
      emptyDay.innerHTML = `<span class="day-number">${day}</span>`;
      calendarGrid.append(emptyDay);
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-day has-workshop ${workshop.status}`;
    if (workshop.id === selectedClassId) button.classList.add("selected");
    button.disabled = workshop.seatsLeft <= 0;
    button.setAttribute("aria-pressed", workshop.id === selectedClassId ? "true" : "false");
    button.innerHTML = `
      <span class="day-number">${day}</span>
      <span class="day-time">${workshop.time}</span>
      <span class="day-seats ${workshop.status === "low" ? "low" : ""}">${workshop.status === "closed" ? "Closed" : `${workshop.seatsLeft} left`}</span>
    `;
    button.addEventListener("click", () => {
      selectedClassId = workshop.id;
      confirmation.hidden = true;
      renderCalendar();
      updateAvailability();
    });
    calendarGrid.append(button);
  }
}

function updateMonth(delta) {
  const [year, month] = visibleMonth.split("-").map(Number);
  visibleMonth = monthKey(new Date(Date.UTC(year, month - 1 + delta, 1)));
  renderCalendar();
}

async function loadAvailability(selectFirst = false) {
  availability.textContent = "Loading current availability...";
  const response = await fetch("/api/availability");
  if (!response.ok) throw new Error("Availability failed");
  const data = await response.json();
  workshops = data.workshops;

  if (selectFirst || !selectedWorkshop()) {
    const nextOpen = workshops.find((item) => item.seatsLeft > 0);
    selectedClassId = nextOpen ? nextOpen.id : "";
    if (nextOpen) visibleMonth = nextOpen.date.slice(0, 7);
  }

  renderCalendar();
  updateAvailability();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const workshop = selectedWorkshop();
  const requestedSeats = Number(data.get("seats"));

  if (!workshop || requestedSeats > workshop.seatsLeft) {
    confirmation.hidden = false;
    confirmation.textContent = "That class no longer has enough seats available. Please choose another date.";
    await loadAvailability();
    updateAvailability();
    return;
  }

  const submit = form.querySelector(".submit");
  submit.disabled = true;
  submit.textContent = "Reserving...";

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId: workshop.id,
        seats: requestedSeats,
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        experience: data.get("experience"),
        notes: data.get("notes")
      })
    });
    const result = await response.json();

    if (!response.ok) {
      workshops = result.workshops || workshops;
      renderCalendar();
      updateAvailability();
      throw new Error(result.error || "Booking failed");
    }

    workshops = result.workshops;
    renderCalendar();
    updateAvailability();
    confirmation.hidden = false;
    confirmation.innerHTML = `<strong>Seats reserved.</strong><br>${requestedSeats} ${requestedSeats === 1 ? "seat" : "seats"} for ${workshop.label}. Lucie can contact you at ${data.get("email")}.`;
    form.reset();
    seats.value = 1;
  } catch (error) {
    confirmation.hidden = false;
    confirmation.textContent = error.message || "The booking could not be saved. Please try again.";
  } finally {
    submit.disabled = false;
    submit.textContent = "Reserve seats";
  }
});

seats.addEventListener("input", updateAvailability);
previousMonth.addEventListener("click", () => updateMonth(-1));
nextMonth.addEventListener("click", () => updateMonth(1));

loadAvailability(true).catch(() => {
  availability.className = "availability full";
  availability.textContent = "The live booking calendar could not load. Please email Lucie directly at mail@lucieverdet.com.";
});
