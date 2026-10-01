const workshops = [
  { id: "2026-10-08", label: "Torsdag d. 8. oktober, kl. 17-20", capacity: 7, booked: 4 },
  { id: "2026-10-11", label: "Søndag d. 11. oktober, kl. 13-16", capacity: 7, booked: 2 },
  { id: "2026-10-20", label: "Tirsdag d. 20. oktober, kl. 17-20", capacity: 7, booked: 5 },
  { id: "2026-11-05", label: "Torsdag d. 5. november, kl. 17-20", capacity: 7, booked: 3 },
  { id: "2026-11-08", label: "Søndag d. 8. november, kl. 13-16", capacity: 7, booked: 1 },
  { id: "2026-11-17", label: "Tirsdag d. 17. november, kl. 17-20", capacity: 7, booked: 5 },
  { id: "2026-12-03", label: "Torsdag d. 3. december, kl. 17-20", capacity: 7, booked: 2 },
  { id: "2026-12-06", label: "Søndag d. 6. december, kl. 13-16", capacity: 7, booked: 4 },
  { id: "2026-12-08", label: "Tirsdag d. 8. december, kl. 17-20", capacity: 7, booked: 0 }
];

const form = document.querySelector("#bookingForm");
const classDate = document.querySelector("#classDate");
const seats = document.querySelector("#seats");
const availability = document.querySelector("#availability");
const confirmation = document.querySelector("#confirmation");

function reservedSeats(id) {
  const saved = JSON.parse(localStorage.getItem("lucieWorkshopBookings") || "[]");
  return saved
    .filter((booking) => booking.classId === id)
    .reduce((total, booking) => total + Number(booking.seats || 0), 0);
}

function seatsLeft(workshop) {
  return workshop.capacity - workshop.booked - reservedSeats(workshop.id);
}

function renderOptions() {
  classDate.innerHTML = "";
  workshops.forEach((workshop) => {
    const option = document.createElement("option");
    const remaining = seatsLeft(workshop);
    option.value = workshop.id;
    option.textContent = `${workshop.label} - ${remaining} seats left`;
    option.disabled = remaining <= 0;
    classDate.append(option);
  });
}

function updateAvailability() {
  const workshop = workshops.find((item) => item.id === classDate.value);
  if (!workshop) return;

  const remaining = seatsLeft(workshop);
  seats.max = Math.max(1, remaining);
  if (Number(seats.value) > remaining) seats.value = Math.max(1, remaining);

  availability.className = "availability";
  if (remaining <= 0) {
    availability.classList.add("full");
    availability.textContent = "This workshop is fully booked. Choose another date or email Lucie for the waitlist.";
  } else if (remaining <= 2) {
    availability.classList.add("low");
    availability.textContent = `Only ${remaining} ${remaining === 1 ? "seat" : "seats"} left for this workshop.`;
  } else {
    availability.textContent = `${remaining} seats available. Small group, maximum ${workshop.capacity} guests.`;
  }
}

function mailtoFor(data, workshop) {
  const subject = encodeURIComponent(`Workshop booking request - ${workshop.label}`);
  const body = encodeURIComponent(
    [
      "Hi Lucie,",
      "",
      "I would like to request a workshop booking.",
      "",
      `Workshop: ${workshop.label}`,
      `Seats: ${data.get("seats")}`,
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Phone: ${data.get("phone") || "Not provided"}`,
      `Experience: ${data.get("experience")}`,
      `Notes: ${data.get("notes") || "None"}`,
      "",
      "Please confirm whether the seats are available.",
      "",
      "Best,"
    ].join("\n")
  );
  return `mailto:mail@lucieverdet.com?subject=${subject}&body=${body}`;
}

function saveBooking(data, workshop) {
  const saved = JSON.parse(localStorage.getItem("lucieWorkshopBookings") || "[]");
  saved.push({
    classId: workshop.id,
    classLabel: workshop.label,
    seats: Number(data.get("seats")),
    name: data.get("name"),
    email: data.get("email"),
    createdAt: new Date().toISOString()
  });
  localStorage.setItem("lucieWorkshopBookings", JSON.stringify(saved));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const workshop = workshops.find((item) => item.id === data.get("classDate"));
  const requestedSeats = Number(data.get("seats"));

  if (!workshop || requestedSeats > seatsLeft(workshop)) {
    confirmation.hidden = false;
    confirmation.textContent = "That class no longer has enough seats available. Please choose another date.";
    renderOptions();
    updateAvailability();
    return;
  }

  saveBooking(data, workshop);
  renderOptions();
  updateAvailability();

  confirmation.hidden = false;
  confirmation.innerHTML = `<strong>Booking request ready.</strong><br>${requestedSeats} ${requestedSeats === 1 ? "seat" : "seats"} for ${workshop.label}. Your email app will open so the request can be sent to Lucie.`;
  window.location.href = mailtoFor(data, workshop);
});

classDate.addEventListener("change", updateAvailability);
seats.addEventListener("input", updateAvailability);

renderOptions();
updateAvailability();
