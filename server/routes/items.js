import { Router } from 'express';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import Item, { CAMPUS_ZONES, ITEM_CATEGORIES } from '../models/Item.js';
import Match from '../models/Match.js';
import Claim from '../models/Claim.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { extractEmbedding, findAndSaveMatches } from '../services/visionMatcher.js';
import { deleteStoredImage, persistUploadedImage } from '../services/imageStorage.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { type, category, locationTag, status, search, page = '1', limit = '24' } = req.query;
    if (type && !['lost', 'found'].includes(type)) return res.status(400).json({ message: 'Type must be lost or found.' });
    if (category && !ITEM_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Choose a valid item category.' });
    if (locationTag && !CAMPUS_ZONES.includes(locationTag)) return res.status(400).json({ message: 'Choose a valid campus zone.' });
    if (status && !['open', 'matched', 'claimed', 'resolved'].includes(status)) return res.status(400).json({ message: 'Choose a valid item status.' });
    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (locationTag) filter.locationTag = locationTag;
    filter.deletedAt = null;
    filter.status = status || { $in: ['open', 'matched', 'resolved'] };
    if (search && String(search).trim()) {
      const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ title: new RegExp(safeSearch, 'i') }, { description: new RegExp(safeSearch, 'i') }];
    }
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(60, Math.max(1, Number.parseInt(limit, 10) || 24));
    const [items, total] = await Promise.all([
      Item.find(filter).select('-embedding').populate('postedBy', 'name department').sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize).limit(pageSize).lean(),
      Item.countDocuments(filter)
    ]);
    return res.json({ items, page: currentPage, pages: Math.ceil(total / pageSize), total });
  } catch (error) {
    return next(error);
  }
});

router.post('/', protect, imageUpload.single('image'), async (req, res, next) => {
  let uploadedPath = req.file?.path;
  let storedImage;
  try {
    const { type, title, description, category, locationTag, specificSpot = '', itemDate, verificationQuestion = '' } = req.body;
    const missing = !type || !title?.trim() || !description?.trim() || !category || !locationTag || !itemDate;
    if (missing || !req.file) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'Complete all required fields and attach an image.' });
    }
    if (!['lost', 'found'].includes(type) || !ITEM_CATEGORIES.includes(category) || !CAMPUS_ZONES.includes(locationTag)) {
      await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'Choose a valid type, category, and campus location.' });
    }
    if (Number.isNaN(Date.parse(itemDate)) || new Date(itemDate) > new Date(Date.now() + 86_400_000)) {
      await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'Enter a valid item date no later than tomorrow.' });
    }
    const imageMetadata = await sharp(uploadedPath).metadata();
    const expectedFormat = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype];
    if (imageMetadata.format !== expectedFormat) {
      await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'The uploaded file is not a valid JPEG, PNG, or WebP image.' });
    }
    const embedding = await extractEmbedding(uploadedPath);
    storedImage = await persistUploadedImage(uploadedPath);
    if (storedImage.remote) {
      await fs.unlink(uploadedPath);
      uploadedPath = null;
    }
    const item = await Item.create({
      type, title, description, category, locationTag, specificSpot, itemDate,
      verificationQuestion, embedding, imageUrl: storedImage.url,
      imagePublicId: storedImage.publicId || null, postedBy: req.user._id
    });
    storedImage = null;
    uploadedPath = null;
    const matches = await findAndSaveMatches(item);
    await item.populate('postedBy', 'name department');
    return res.status(201).json({ item: item.toObject({ transform: (_doc, value) => {
      delete value.embedding;
      delete value.imagePublicId;
      return value;
    } }), matches });
  } catch (error) {
    if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
    if (storedImage?.remote) {
      try {
        await deleteStoredImage(storedImage.url, storedImage.publicId);
      } catch (cleanupError) {
        console.error(`Failed to remove an unclaimed uploaded image: ${cleanupError.message}`);
      }
    }
    return next(error);
  }
});

router.patch('/:id', protect, imageUpload.single('image'), async (req, res, next) => {
  let uploadedPath = req.file?.path;
  let storedImage;
  try {
    const item = await Item.findById(req.params.id).select('+embedding +imagePublicId');
    if (!item) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(404).json({ message: 'Item not found.' });
    }
    if (!item.postedBy.equals(req.user._id) && req.user.role !== 'admin') {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(403).json({ message: 'Only the reporter can edit this item.' });
    }
    if (item.deletedAt) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(409).json({ message: 'Restore this report before editing it.' });
    }
    if (!['open', 'matched'].includes(item.status)) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(409).json({ message: 'Only open or matched reports can be edited.' });
    }

    const editableFields = ['type', 'title', 'description', 'category', 'locationTag', 'specificSpot', 'itemDate', 'verificationQuestion'];
    const unknownField = Object.keys(req.body).find((field) => !editableFields.includes(field));
    if (unknownField) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: `Field "${unknownField}" cannot be updated here.` });
    }
    if (!editableFields.some((field) => Object.hasOwn(req.body, field)) && !req.file) {
      return res.status(400).json({ message: 'Provide at least one field or a replacement image.' });
    }
    if (req.body.type && !['lost', 'found'].includes(req.body.type)) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'Type must be lost or found.' });
    }
    if (req.body.category && !ITEM_CATEGORIES.includes(req.body.category)) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'Choose a valid item category.' });
    }
    if (req.body.locationTag && !CAMPUS_ZONES.includes(req.body.locationTag)) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'Choose a valid campus zone.' });
    }
    if (req.body.itemDate && (Number.isNaN(Date.parse(req.body.itemDate)) || new Date(req.body.itemDate) > new Date(Date.now() + 86_400_000))) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ message: 'Enter a valid item date no later than tomorrow.' });
    }

    const previousImageUrl = item.imageUrl;
    const previousImagePublicId = item.imagePublicId;
    for (const field of editableFields) {
      if (Object.hasOwn(req.body, field)) item[field] = req.body[field];
    }
    if (uploadedPath) {
      const metadata = await sharp(uploadedPath).metadata();
      const expectedFormat = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype];
      if (metadata.format !== expectedFormat) {
        await fs.unlink(uploadedPath).catch(() => {});
        uploadedPath = null;
        return res.status(400).json({ message: 'The uploaded file is not a valid JPEG, PNG, or WebP image.' });
      }
      item.embedding = await extractEmbedding(uploadedPath);
      storedImage = await persistUploadedImage(uploadedPath);
      if (storedImage.remote) {
        await fs.unlink(uploadedPath);
        uploadedPath = null;
      }
      item.imageUrl = storedImage.url;
      item.imagePublicId = storedImage.publicId || null;
    }
    await item.save();
    storedImage = null;
    uploadedPath = null;
    await Match.deleteMany({ $or: [{ lostItem: item._id }, { foundItem: item._id }] });
    const matches = await findAndSaveMatches(item);
    if (previousImageUrl !== item.imageUrl) {
      await deleteStoredImage(previousImageUrl, previousImagePublicId);
    }
    await item.populate('postedBy', 'name department');
    const itemData = item.toObject({ transform: (_doc, value) => {
      delete value.embedding;
      delete value.imagePublicId;
      return value;
    } });
    return res.json({ item: itemData, matches });
  } catch (error) {
    if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
    if (storedImage?.remote) {
      try {
        await deleteStoredImage(storedImage.url, storedImage.publicId);
      } catch (cleanupError) {
        console.error(`Failed to remove an unclaimed replacement image: ${cleanupError.message}`);
      }
    }
    return next(error);
  }
});

router.get('/mine', protect, async (req, res, next) => {
  try {
    const items = await Item.find({ postedBy: req.user._id }).select('-embedding')
      .sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin', protect, adminOnly, async (req, res, next) => {
  try {
    const currentPage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(60, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const filter = { deletedAt: null };
    const [items, total] = await Promise.all([
      Item.find(filter).select('-embedding').populate('postedBy', 'name department')
        .sort({ createdAt: -1 }).skip((currentPage - 1) * pageSize).limit(pageSize).lean(),
      Item.countDocuments(filter)
    ]);
    return res.json({ items, page: currentPage, pages: Math.max(1, Math.ceil(total / pageSize)), total });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/matches', protect, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id).select('postedBy');
    if (!item || item.deletedAt) return res.status(404).json({ message: 'Item not found.' });
    if (!item.postedBy.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the reporter can view this item’s match list.' });
    }
    const matches = await Match.find({ $or: [{ lostItem: item._id }, { foundItem: item._id }] })
      .populate({ path: 'lostItem', select: '-embedding', populate: { path: 'postedBy', select: 'name department' } })
      .populate({ path: 'foundItem', select: '-embedding', populate: { path: 'postedBy', select: 'name department' } })
      .sort({ totalScore: -1 }).lean();
    return res.json({ matches: matches.filter((match) => match.lostItem && match.foundItem) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, deletedAt: null }).select('-embedding')
      .populate('postedBy', 'name department');
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    return res.json({ item });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Status must be open or resolved.' });
    }
    const item = await Item.findById(req.params.id);
    if (!item || item.deletedAt) return res.status(404).json({ message: 'Item not found.' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can update report status.' });
    }
    if (status === 'open' && await Claim.exists({ item: item._id, status: { $in: ['pending', 'approved'] } })) {
      return res.status(409).json({ message: 'Resolve active claims before reopening this report.' });
    }
    item.status = status;
    await item.save();
    return res.json({ item: await item.populate('postedBy', 'name department') });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    if (!item.postedBy.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the reporter can remove this item.' });
    }
    if (item.deletedAt) return res.status(409).json({ message: 'This report has already been removed.' });
    const activeClaim = await Claim.exists({ item: item._id, status: { $in: ['pending', 'approved'] } });
    if (activeClaim) return res.status(409).json({ message: 'This item has an active claim. Resolve the claim before removing it.' });
    item.deletedAt = new Date();
    item.deletedBy = req.user._id;
    await item.save();
    return res.json({ message: 'Report removed from public listings. Its deletion has been recorded.', item });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/restore', protect, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    if (!item.postedBy.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the reporter can restore this item.' });
    }
    if (!item.deletedAt) return res.status(409).json({ message: 'This report is already active.' });
    item.deletedAt = null;
    item.deletedBy = null;
    await item.save();
    const matches = ['open', 'matched'].includes(item.status) ? await findAndSaveMatches(item) : [];
    return res.json({ item: await item.populate('postedBy', 'name department'), matches });
  } catch (error) {
    return next(error);
  }
});

export default router;
