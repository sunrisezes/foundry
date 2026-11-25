import { del, put } from '@vercel/blob';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadDirectory } from '../middleware/upload.js';

function hasCloudinaryConfiguration() {
  const credentials = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  };
  const configuredCredentials = Object.values(credentials).filter(Boolean).length;

  if (!process.env.CLOUDINARY_URL && configuredCredentials > 0 && configuredCredentials < 3) {
    throw new Error('Set CLOUDINARY_URL or all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }
  if (configuredCredentials === 3) {
    cloudinary.config({ ...credentials, secure: true });
  }
  return Boolean(process.env.CLOUDINARY_URL || configuredCredentials === 3);
}

async function uploadToCloudinary(filePath) {
  const image = await fs.readFile(filePath);
  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: 'campus-lost-found/items',
      public_id: path.parse(filePath).name,
      resource_type: 'image',
      overwrite: false
    }, (error, uploadedImage) => {
      if (error) return reject(error);
      if (!uploadedImage?.secure_url || !uploadedImage.public_id) {
        return reject(new Error('Cloudinary returned an incomplete image upload response.'));
      }
      return resolve(uploadedImage);
    });
    uploadStream.end(image);
  });
  return { url: result.secure_url, publicId: result.public_id, remote: true };
}

export async function persistUploadedImage(filePath) {
  const provider = process.env.IMAGE_STORAGE_PROVIDER?.trim().toLowerCase();
  const providers = ['auto', 'cloudinary', 'blob', 'local'];
  if (provider && !providers.includes(provider)) {
    throw new Error(`Unsupported IMAGE_STORAGE_PROVIDER "${provider}". Choose auto, cloudinary, blob, or local.`);
  }

  if (provider === 'cloudinary' || provider === 'auto' || !provider) {
    const configured = hasCloudinaryConfiguration();
    if (provider === 'cloudinary' && !configured) {
      throw new Error('IMAGE_STORAGE_PROVIDER is cloudinary but Cloudinary credentials are not configured.');
    }
    if (configured) return uploadToCloudinary(filePath);
  }

  if (provider === 'blob' || ((!provider || provider === 'auto') && process.env.BLOB_READ_WRITE_TOKEN)) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('IMAGE_STORAGE_PROVIDER is blob but BLOB_READ_WRITE_TOKEN is not configured.');
    }
    const blob = await put(`items/${path.basename(filePath)}`, await fs.readFile(filePath), { access: 'public' });
    return { url: blob.url, remote: true };
  }

  if (provider === 'local') {
    if (process.env.VERCEL === '1') {
      throw new Error('Local image storage is unavailable on Vercel. Configure Cloudinary or Vercel Blob.');
    }
    return { url: `/uploads/${path.basename(filePath)}`, remote: false };
  }

  if (process.env.VERCEL === '1') {
    throw new Error('Configure CLOUDINARY_URL (or all three CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET values) to store uploaded images on Vercel.');
  }

  return { url: `/uploads/${path.basename(filePath)}`, remote: false };
}

export async function deleteStoredImage(imageUrl, publicId) {
  if (imageUrl.startsWith('/uploads/')) {
    const filePath = path.join(uploadDirectory, path.basename(imageUrl));
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }

  if (publicId) {
    if (!hasCloudinaryConfiguration()) {
      throw new Error('Cloudinary credentials are required to delete this image.');
    }
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    if (!['ok', 'not found'].includes(result.result)) {
      throw new Error(`Cloudinary could not delete image "${publicId}".`);
    }
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
