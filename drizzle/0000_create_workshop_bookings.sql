CREATE TABLE IF NOT EXISTS workshop_bookings (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK (seats > 0),
  booking_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workshop_bookings_class_status
ON workshop_bookings(class_id, status);

PRAGMA optimize;
