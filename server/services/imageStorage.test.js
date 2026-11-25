import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { v2 as cloudinary } from 'cloudinary';

const directory = await mkdtemp(path.join(os.tmpdir(), 'campus-image-storage-'));
process.env.UPLOAD_DIR = directory;
delete process.env.VERCEL;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.CLOUDINARY_URL;
delete process.env.CLOUDINARY_CLOUD_NAME;
delete process.env.CLOUDINARY_API_KEY;
delete process.env.CLOUDINARY_API_SECRET;
delete process.env.IMAGE_STORAGE_PROVIDER;

const { deleteStoredImage, persistUploadedImage } = await import('./imageStorage.js');

test('stores locally without cloud credentials and requires a remote provider on Vercel', async () => {
  const filePath = path.join(directory, 'item.jpg');
  await writeFile(filePath, 'image');
  const storedImage = await persistUploadedImage(filePath);

  assert.deepEqual(storedImage, { url: '/uploads/item.jpg', remote: false });
  await deleteStoredImage(storedImage.url);
  await assert.rejects(
    readFile(filePath),
    { code: 'ENOENT' }
  );

  process.env.VERCEL = '1';
  await assert.rejects(
    persistUploadedImage(filePath),
    /Configure CLOUDINARY_URL/
  );
  process.env.IMAGE_STORAGE_PROVIDER = 'cloudinary';
  await assert.rejects(
    persistUploadedImage(filePath),
    /Cloudinary credentials are not configured/
  );
});

test('uploads to Cloudinary and deletes by public ID', async () => {
  const filePath = path.join(directory, 'cloud-item.jpg');
  await writeFile(filePath, 'image');
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  process.env.IMAGE_STORAGE_PROVIDER = 'cloudinary';

  const originalUploadStream = cloudinary.uploader.upload_stream;
  const originalDestroy = cloudinary.uploader.destroy;
  let uploadedOptions;
  let deletedPublicId;

  cloudinary.uploader.upload_stream = (options, callback) => {
    uploadedOptions = options;
    return {
      end: (buffer) => {
        assert.equal(buffer.toString(), 'image');
        callback(null, {
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/campus-lost-found/items/cloud-item.jpg',
          public_id: 'campus-lost-found/items/cloud-item'
        });
      }
    };
  };
  cloudinary.uploader.destroy = async (publicId, options) => {
    deletedPublicId = publicId;
    assert.deepEqual(options, { resource_type: 'image' });
    return { result: 'ok' };
  };

  try {
    const storedImage = await persistUploadedImage(filePath);
    assert.equal(storedImage.url, 'https://res.cloudinary.com/test-cloud/image/upload/v1/campus-lost-found/items/cloud-item.jpg');
    assert.equal(storedImage.publicId, 'campus-lost-found/items/cloud-item');
    assert.equal(storedImage.remote, true);
    assert.equal(uploadedOptions.folder, 'campus-lost-found/items');
    assert.equal(uploadedOptions.public_id, 'cloud-item');

    await deleteStoredImage(storedImage.url, storedImage.publicId);
    assert.equal(deletedPublicId, storedImage.publicId);
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
    cloudinary.uploader.destroy = originalDestroy;
  }
});

test.after(async () => {
  await rm(directory, { recursive: true, force: true });
});
