-- Zähler für automatische Transkriptions-Wiederholungen + letzter Fehlertext.
ALTER TABLE kv_videos
  ADD COLUMN IF NOT EXISTS transcript_retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcript_error text;
