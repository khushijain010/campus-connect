import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOAD_DIR can point at a persistent disk in production (like DB_PATH for the database).
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only JPG, PNG, GIF or WEBP images are allowed'), { status: 400 }));
  },
});

const DOC_TYPES = /^(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-(powerpoint|excel)|zip|x-zip-compressed)|text\/plain)$/;

// Posts accept up to 6 images plus one document attachment (PDF, Office, ZIP, TXT).
export const postUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'images' && /^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    if (file.fieldname === 'file' && DOC_TYPES.test(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error(file.fieldname === 'file' ? 'Attach a PDF, Office document, ZIP or text file' : 'Only JPG, PNG, GIF or WEBP images are allowed'), { status: 400 }));
  },
});

export const fileUrl = (file) => (file ? `/uploads/${file.filename}` : null);
