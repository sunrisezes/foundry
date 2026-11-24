import { del, put } from '@vercel/blob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadDirectory } from '../middleware/upload.js';

export async function persistUploadedImage(filePath) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (process.env.VERCEL === '1') {
      throw new Error('BLOB_READ_WRITE_TOKEN is required to store uploaded images on Vercel.');
    }
    return { url: `/uploads/${path.basename(filePath)}`, remote: false };
  }

  const blob = await put(`items/${path.basename(filePath)}`, await fs.readFile(filePath), { access: 'public' });
  return { url: blob.url, remote: true };
}

export async function deleteStoredImage(imageUrl) {
  if (imageUrl.startsWith('/uploads/')) {
    const filePath = path.join(uploadDirectory, path.basename(imageUrl));
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }

  if (!/^https:\/\//i.test(imageUrl)) {
    throw new Error('Cannot delete an unsupported image URL.');
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required to delete a Vercel Blob image.');
  }
  await del(imageUrl);
}
