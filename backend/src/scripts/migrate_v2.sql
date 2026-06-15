-- ─── Migration v2: Multiple IDs + Companions ─────────────────────────────────
-- Run this in cPanel phpMyAdmin or MySQL terminal

-- 1. Add extra ID columns to guest_documents
ALTER TABLE guest_documents 
  ADD COLUMN IF NOT EXISTS id_3 VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS id_4 VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS id_5 VARCHAR(500) DEFAULT NULL;

-- 2. Create booking_companions table to link extra guests to a booking
CREATE TABLE IF NOT EXISTS booking_companions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT NOT NULL,
  guest_id    INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_booking_id (booking_id),
  INDEX idx_guest_id   (guest_id)
);
