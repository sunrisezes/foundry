import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const directory = await mkdtemp(path.join(os.tmpdir(), 'campus-image-storage-'));
process.env.UPLOAD_DIR = directory;
delete process.env.VERCEL;
delete process.env.BLOB_READ_WRITE_TOKEN;

const { deleteStoredImage, persistUploadedImage } = await import('./imageStorage.js');

test('preserves local uploads and requires Blob storage on Vercel', async () => {
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
    /BLOB_READ_WRITE_TOKEN is required to store uploaded images on Vercel/
  );
});

test.after(async () => {
  await rm(directory, { recursive: true, force: true });
});
