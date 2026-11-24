import crypto from 'node:crypto';
import { Router } from 'express';
import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const claims = await Claim.find({ $or: [{ claimant: req.user._id }, { ownerOrFinder: req.user._id }] }).select('+handoverCode')
      .populate({ path: 'item', select: '-embedding' })
      .populate('match')
      .populate('claimant', 'name department')
      .populate('ownerOrFinder', 'name department')
      .sort({ updatedAt: -1 }).lean();
    for (const claim of claims) {
      if (String(claim.ownerOrFinder._id) !== String(req.user._id)) claim.handoverCode = null;
    }
    return res.json({ claims });
  } catch (error) {
    return next(error);
  }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { itemId, matchId, verificationAnswer } = req.body;
    if (typeof verificationAnswer !== 'string' || !verificationAnswer.trim()) {
      return res.status(400).json({ message: 'Provide an answer to help verify your claim.' });
    }
    const item = await Item.findOne({ _id: itemId, deletedAt: null });
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    if (item.type !== 'found' || !['open', 'matched'].includes(item.status)) {
      return res.status(409).json({ message: 'This found item is not available to claim.' });
    }
    if (item.postedBy.equals(req.user._id)) {
      return res.status(400).json({ message: 'You cannot claim an item you reported.' });
    }
    let match = null;
    if (matchId) {
      match = await Match.findById(matchId);
      if (!match || ![String(match.foundItem), String(match.lostItem)].includes(String(item._id))) {
        return res.status(400).json({ message: 'That match does not belong to this item.' });
      }
      const activeReports = await Item.countDocuments({
        _id: { $in: [match.lostItem, match.foundItem] },
        deletedAt: null
      });
      if (activeReports !== 2) {
        return res.status(409).json({ message: 'That match includes a report that has been removed.' });
      }
    }
    const existing = await Claim.findOne({ item: item._id, claimant: req.user._id, status: { $in: ['pending', 'approved'] } });
    if (existing) return res.status(409).json({ message: 'You already have an active claim for this item.' });
    const claim = await Claim.create({
      item: item._id,
      match: match?._id || null,
      claimant: req.user._id,
      ownerOrFinder: item.postedBy,
      verificationAnswer: verificationAnswer.trim()
    });
    return res.status(201).json({ claim: await claim.populate([{ path: 'item', select: '-embedding' }, { path: 'claimant', select: 'name' }, { path: 'ownerOrFinder', select: 'name' }]) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected.' });
    }
    const claim = await Claim.findById(req.params.id).populate('item');
    if (!claim) return res.status(404).json({ message: 'Claim not found.' });
    if (!claim.ownerOrFinder.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the reporter can decide this claim.' });
    }
    if (claim.status !== 'pending') return res.status(409).json({ message: 'This claim has already been decided.' });
    claim.status = status;
    if (status === 'approved') {
      claim.handoverCode = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      claim.item.status = 'claimed';
      await claim.item.save();
    }
    await claim.save();
    const result = await Claim.findById(claim._id).select('+handoverCode')
      .populate({ path: 'item', select: '-embedding' })
      .populate('claimant', 'name')
      .populate('ownerOrFinder', 'name');
    return res.json({ claim: result });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/messages', protect, async (req, res, next) => {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 1000) return res.status(400).json({ message: 'Message must contain 1–1000 characters.' });
    const claim = await Claim.findById(req.params.id).populate('claimant ownerOrFinder', 'name');
    if (!claim) return res.status(404).json({ message: 'Claim not found.' });
    const isParticipant = claim.claimant._id.equals(req.user._id) || claim.ownerOrFinder._id.equals(req.user._id);
    if (!isParticipant && req.user.role !== 'admin') return res.status(403).json({ message: 'Only claim participants can message.' });
    if (['rejected', 'completed'].includes(claim.status)) return res.status(409).json({ message: 'This claim conversation is closed.' });
    claim.messages.push({ sender: req.user._id, senderName: req.user.name, text });
    await claim.save();
    return res.status(201).json({ claim });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/complete', protect, async (req, res, next) => {
  try {
    const { handoverCode } = req.body;
    if (typeof handoverCode !== 'string' || !/^\d{6}$/.test(handoverCode)) {
      return res.status(400).json({ message: 'Enter the six-digit handover code.' });
    }
    const claim = await Claim.findById(req.params.id).select('+handoverCode');
    if (!claim) return res.status(404).json({ message: 'Claim not found.' });
    if (!claim.claimant.equals(req.user._id) && !claim.ownerOrFinder.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only claim participants can complete the handover.' });
    }
    if (claim.status !== 'approved' || claim.handoverCode !== handoverCode) {
      return res.status(400).json({ message: 'The code is incorrect or the claim is not approved.' });
    }
    claim.status = 'completed';
    claim.handoverCode = null;
    await claim.save();
    await Item.findByIdAndUpdate(claim.item, { status: 'resolved' });
    return res.json({ claim: await Claim.findById(claim._id).populate('item', '-embedding') });
  } catch (error) {
    return next(error);
  }
});

export default router;
