CREATE TABLE IF NOT EXISTS pcc_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT NOT NULL UNIQUE,
  event_id TEXT,
  topic TEXT NOT NULL,
  resource TEXT NOT NULL,
  application_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  sent TEXT,
  first_received TEXT NOT NULL,
  last_received TEXT NOT NULL,
  deliveries INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_status TEXT NOT NULL DEFAULT 'unverified'
);
CREATE INDEX IF NOT EXISTS pcc_notifications_pending
  ON pcc_notifications(status, id);
