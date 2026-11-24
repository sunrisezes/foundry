import { Router } from 'express';
import User from '../models/User.js';
import { protect, createToken } from '../middleware/auth.js';

const router = Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    role: user.role,
    department: user.department,
    phone: user.phone
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, studentId, email, password, department = '', phone = '' } = req.body;
    if (![name, studentId, email, password].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Name, student ID, email, and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    const user = await User.create({ name, studentId, email, password, department, phone });
    return res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
