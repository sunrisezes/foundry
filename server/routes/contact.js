import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import ContactMessage from '../models/ContactMessage.js';
import { adminOnly, protect } from '../middleware/auth.js';

const router = Router();
const topics = ['General question', 'Technical help', 'Report concern', 'Privacy request', 'Other'];
const submissionLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many messages were submitted. Please try again later.' }
});

router.post('/', submissionLimit, async (req, res, next) => {
  try {
    const { name, email, topic, message } = req.body;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ message: 'Name must be between 2 and 100 characters.' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (!topics.includes(topic)) {
      return res.status(400).json({ message: 'Choose a valid message topic.' });
    }
    if (typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 5000) {
      return res.status(400).json({ message: 'Message must be between 10 and 5000 characters.' });
    }
    const submission = await ContactMessage.create({ name, email, topic, message });
    return res.status(201).json({ message: 'Your message was sent to the campus support inbox.', submissionId: submission.id });
  } catch (error) {
    return next(error);
  }
});

router.get('/', protect, adminOnly, async (_req, res, next) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ messages });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Status must be reviewed or resolved.' });
    }
    const submission = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!submission) return res.status(404).json({ message: 'Contact message not found.' });
    return res.json({ submission });
  } catch (error) {
    return next(error);
  }
});

export default router;
