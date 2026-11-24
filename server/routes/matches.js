import { Router } from 'express';
import Match from '../models/Match.js';
import Item from '../models/Item.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const userItems = await Item.find({ postedBy: req.user._id, deletedAt: null }).select('_id').lean();
    const ids = userItems.map((item) => item._id);
    const matches = await Match.find({
      $or: [{ lostItem: { $in: ids } }, { foundItem: { $in: ids } }]
    })
      .populate({ path: 'lostItem', match: { deletedAt: null }, select: '-embedding', populate: { path: 'postedBy', select: 'name department' } })
      .populate({ path: 'foundItem', match: { deletedAt: null }, select: '-embedding', populate: { path: 'postedBy', select: 'name department' } })
      .sort({ totalScore: -1, createdAt: -1 }).lean();
    return res.json({ matches: matches.filter((match) => match.lostItem && match.foundItem) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Status must be confirmed or dismissed.' });
    }
    const match = await Match.findById(req.params.id).populate('lostItem foundItem');
    if (!match) return res.status(404).json({ message: 'Match not found.' });
    if (!match.lostItem || !match.foundItem) return res.status(404).json({ message: 'A report in this match no longer exists.' });
    if (match.lostItem.deletedAt || match.foundItem.deletedAt) {
      return res.status(409).json({ message: 'This match includes a report that has been removed.' });
    }
    const isParticipant = match.lostItem.postedBy.equals(req.user._id) || match.foundItem.postedBy.equals(req.user._id);
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only a reporter in this match can update it.' });
    }
    match.status = status;
    await match.save();
    return res.json({ match });
  } catch (error) {
    return next(error);
  }
});

export default router;
