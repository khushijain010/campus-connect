import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UPLOAD_DIR } from './upload.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import activityRoutes from './routes/activities.js';
import cultureRoutes from './routes/culture.js';
import chatRoutes from './routes/chats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  // Public routes (meta, auth) first; every other router enforces auth itself.
  app.use('/api', authRoutes);
  app.use('/api', userRoutes);
  app.use('/api', postRoutes);
  app.use('/api', activityRoutes);
  app.use('/api', cultureRoutes);
  app.use('/api', chatRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built client in production.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (images 5 MB, documents 10 MB)' : err.message || 'Something went wrong' });
  });
  return app;
}
