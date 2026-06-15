import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { searchGuestByPhone, createGuest, updateGuest, getAllGuests } from '../controllers/guestController.js';

const router = express.Router();

// File filter to restrict uploads to images or PDFs
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|pdf/;
  const ext = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedExtensions.test(file.mimetype);

  if (ext && mime) {
    return cb(null, true);
  }
  cb(new Error('Invalid file type. Only JPEG, JPG, PNG, WEBP images or PDF files are allowed.'));
};

// Use memory storage for direct upload to Cloudflare R2 on the backend controller
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
});

const uploadFields = upload.fields([
  { name: 'guest_photo', maxCount: 1 },
  { name: 'id_front',   maxCount: 1 },
  { name: 'id_back',    maxCount: 1 },
  { name: 'id_3',       maxCount: 1 },
  { name: 'id_4',       maxCount: 1 },
  { name: 'id_5',       maxCount: 1 },
]);

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/', getAllGuests);
router.get('/search', searchGuestByPhone);
router.post('/', uploadFields, createGuest);
router.put('/:id', uploadFields, updateGuest);

export default router;
