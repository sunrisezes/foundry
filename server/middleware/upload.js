import multer from 'multer';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const defaultUploadDirectory = process.env.VERCEL === '1'
  ? path.join('/tmp', 'campus-lost-found-uploads')
  : 'uploads';
const configuredUploadDirectory = process.env.UPLOAD_DIR || defaultUploadDirectory;
const effectiveUploadDirectory = process.env.VERCEL === '1' && !path.isAbsolute(configuredUploadDirectory)
  ? path.join('/tmp', configuredUploadDirectory)
  : configuredUploadDirectory;

export const uploadDirectory = path.resolve(effectiveUploadDirectory);
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${file.extension || '.img'}`);
  }
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    if (!extensions[file.mimetype]) {
      const error = new Error('Upload a JPEG, PNG, or WebP image.');
      error.status = 400;
      return callback(error);
    }
    file.extension = extensions[file.mimetype];
    return callback(null, true);
  }
});
