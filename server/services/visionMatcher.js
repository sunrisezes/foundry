import sharp from 'sharp';
import Item from '../models/Item.js';
import Match from '../models/Match.js';

const MATCH_THRESHOLD = 0.55;
const ZONE_NEIGHBORS = {
  Library: ['Student Center', 'Arts Building', 'Administration'],
  'Student Center': ['Library', 'Dining Hall', 'Sports Complex'],
  'Science Building': ['Engineering Building', 'Library'],
  'Engineering Building': ['Science Building', 'Administration'],
  'Arts Building': ['Library', 'Student Center'],
  Administration: ['Library', 'Engineering Building'],
  'Sports Complex': ['Student Center', 'Residence Hall'],
  'Residence Hall': ['Sports Complex', 'Dining Hall'],
  'Dining Hall': ['Student Center', 'Residence Hall'],
  Other: []
};

let extractorPromise;
let extractor;
let usingFallback = false;

function unitNormalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude || !Number.isFinite(magnitude)) throw new Error('Could not generate a valid image descriptor.');
  return vector.map((value) => value / magnitude);
}

async function loadExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      if (process.env.VISION_OFFLINE === '1' || process.env.VERCEL === '1') {
        usingFallback = true;
        console.warn('Using the local Sharp visual descriptor.');
        return null;
      }
      try {
        const { pipeline } = await import('@huggingface/transformers');
        const model = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
        console.log('Loaded local CLIP image feature extractor');
        return model;
      } catch (error) {
        usingFallback = true;
        console.warn(`CLIP weights unavailable; using the local Sharp visual descriptor: ${error.message}`);
        return null;
      }
    })();
  }
  extractor = await extractorPromise;
  return extractor;
}

async function sharpDescriptor(imagePath) {
  const { data, info } = await sharp(imagePath)
    .rotate()
    .resize(32, 32, { fit: 'cover' })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const histogram = new Array(96).fill(0);
  const spatial = new Array(3 * 4 * 4).fill(0);
  const gray = new Float32Array(info.width * info.height);
  const pixels = info.width * info.height;

  for (let index = 0; index < pixels; index += 1) {
    const offset = index * info.channels;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue = (hue / 6 + 1) % 1;
    }
    const saturation = max === 0 ? 0 : delta / max;
    histogram[Math.min(15, Math.floor(r * 16))] += 1;
    histogram[16 + Math.min(15, Math.floor(g * 16))] += 1;
    histogram[32 + Math.min(15, Math.floor(b * 16))] += 1;
    histogram[48 + Math.min(15, Math.floor(hue * 16))] += 1;
    histogram[64 + Math.min(15, Math.floor(saturation * 16))] += 1;
    histogram[80 + Math.min(15, Math.floor(max * 16))] += 1;
    // Include HSV through a compact spatial color summary.
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    const cell = (Math.floor(y / 8) * 4 + Math.floor(x / 8)) * 3;
    spatial[cell] += hue;
    spatial[cell + 1] += saturation;
    spatial[cell + 2] += max;
    gray[index] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  for (let i = 0; i < histogram.length; i += 1) histogram[i] /= pixels;
  for (let i = 0; i < spatial.length; i += 1) spatial[i] /= 64;

  const edges = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      const dx = x < info.width - 1 ? gray[index + 1] - gray[index] : 0;
      const dy = y < info.height - 1 ? gray[index + info.width] - gray[index] : 0;
      edges.push(Math.hypot(dx, dy));
    }
  }
  const edgeHistogram = new Array(16).fill(0);
  for (const edge of edges) edgeHistogram[Math.min(15, Math.floor(edge * 32))] += 1;
  for (let i = 0; i < edgeHistogram.length; i += 1) edgeHistogram[i] /= pixels;

  return unitNormalize([...histogram, ...spatial, ...edgeHistogram]);
}

export async function initializeVision() {
  await loadExtractor();
}

export async function extractEmbedding(imagePath) {
  const model = await loadExtractor();
  if (!model || usingFallback) return sharpDescriptor(imagePath);
  try {
    const output = await model(imagePath, { pooling: 'mean', normalize: true });
    const values = output.data ? Array.from(output.data) : output.tolist().flat(Infinity);
    if (values.length !== 512) throw new Error(`Expected a 512-dimensional image embedding, received ${values.length}.`);
    return unitNormalize(values);
  } catch (error) {
    usingFallback = true;
    console.warn(`CLIP image extraction failed; using the local Sharp visual descriptor: ${error.message}`);
    return sharpDescriptor(imagePath);
  }
}

export function cosineSimilarity(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length || first.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < first.length; index += 1) {
    dot += first[index] * second[index];
    normA += first[index] ** 2;
    normB += second[index] ** 2;
  }
  if (!normA || !normB) return 0;
  return Math.max(0, Math.min(1, (dot / (Math.sqrt(normA) * Math.sqrt(normB)) + 1) / 2));
}

function locationSimilarity(first, second) {
  if (first === second) return 1;
  return ZONE_NEIGHBORS[first]?.includes(second) ? 0.6 : 0.2;
}

function categoryAndTimeSimilarity(first, second) {
  const days = Math.abs(new Date(first.itemDate) - new Date(second.itemDate)) / 86_400_000;
  const categoryMatches = first.category === second.category;
  if (categoryMatches && days <= 7) return 1;
  const categoryScore = categoryMatches ? 0.5 : 0;
  const timeScore = Math.max(0, 1 - days / 30) * 0.5;
  return categoryScore + timeScore;
}

export async function findAndSaveMatches(item) {
  const candidates = await Item.find({
    _id: { $ne: item._id },
    type: item.type === 'lost' ? 'found' : 'lost',
    status: 'open',
    deletedAt: null
  }).select('+embedding');
  const results = [];

  for (const candidate of candidates) {
    const visualScore = cosineSimilarity(item.embedding, candidate.embedding);
    const locationScore = locationSimilarity(item.locationTag, candidate.locationTag);
    const categoryScore = categoryAndTimeSimilarity(item, candidate);
    const totalScore = visualScore * 0.65 + locationScore * 0.25 + categoryScore * 0.1;
    if (totalScore < MATCH_THRESHOLD) continue;

    const lostItem = item.type === 'lost' ? item._id : candidate._id;
    const foundItem = item.type === 'found' ? item._id : candidate._id;
    const match = await Match.findOneAndUpdate(
      { lostItem, foundItem },
      { $setOnInsert: { lostItem, foundItem, visualScore, locationScore, categoryScore, totalScore } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push(match);
  }

  return results.sort((a, b) => b.totalScore - a.totalScore);
}
