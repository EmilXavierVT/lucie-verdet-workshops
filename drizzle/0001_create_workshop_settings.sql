CREATE TABLE IF NOT EXISTS workshop_settings (
  class_id TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA optimize;
