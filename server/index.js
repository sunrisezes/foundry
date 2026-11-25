import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/db.js';
import { uploadDirectory } from './middleware/upload.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { initializeVision } from './services/visionMatcher.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import matchRoutes from './routes/matches.js';
import claimRoutes from './routes/claims.js';
import contactRoutes from './routes/contact.js';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientBuildDirectory = path.resolve(currentDirectory, '../client/dist');
const port = Number(process.env.PORT) || 5000;
const configuredOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || [];
const allowedOrigins = [...new Set([
  'http://localhost:5173',
  'https://foundry-pi-six.vercel.app',
  'https://foundry-sunrisezes.vercel.app',
  ...configuredOrigins
])];

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDirectory, { maxAge: '1d', immutable: true }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/contact', contactRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

if (
  process.env.NODE_ENV === 'production'
  && process.env.VERCEL !== '1'
  && existsSync(path.join(clientBuildDirectory, 'index.html'))
) {
  app.use(express.static(clientBuildDirectory));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(clientBuildDirectory, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }
  await connectDatabase();
  app.listen(port, () => console.log(`Campus Lost & Found API listening on port ${port}`));
  initializeVision().catch((error) => {
    console.error(`Vision initialization failed: ${error.message}`);
  });
}

if (process.env.VERCEL === '1') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }
  await connectDatabase();
} else {
  try {
    await startServer();
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
