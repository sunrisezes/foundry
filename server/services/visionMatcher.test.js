import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import test from 'node:test';

process.env.VISION_OFFLINE = '1';
const { extractEmbedding, cosineSimilarity } = await import('./visionMatcher.js');

test('offline image descriptor is deterministic, normalized, and includes RGB/HSV/spatial/edge features', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'campus-vision-'));
  try {
    const imagePath = path.join(directory, 'item.png');
    await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 190, g: 70, b: 35 }
      }
    }).png().toFile(imagePath);

    const first = await extractEmbedding(imagePath);
    const second = await extractEmbedding(imagePath);
    assert.equal(first.length, 160);
    assert.ok(first.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...first) - 1) < 1e-6);
    assert.deepEqual(first, second);
    assert.equal(cosineSimilarity(first, second), 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('cosine similarity is normalized into a bounded score', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0.5);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), 0);
  assert.equal(cosineSimilarity([1], [1, 0]), 0);
});
