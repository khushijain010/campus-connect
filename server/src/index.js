import http from 'node:http';
import { Server } from 'socket.io';
import { openDb, q } from './db.js';
import { createApp } from './app.js';
import { verifyToken } from './auth.js';
import { setIo } from './realtime.js';
import { completePastActivities } from './services.js';
import { seedIfEmpty } from './seed.js';

openDb();
await seedIfEmpty();

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
setIo(io);

io.use((socket, next) => {
  const payload = verifyToken(socket.handshake.auth?.token);
  if (!payload) return next(new Error('unauthorized'));
  socket.userId = payload.id;
  next();
});

io.on('connection', (socket) => {
  const uid = socket.userId;
  socket.join(`user:${uid}`);
  for (const { conversation_id } of q.all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', uid)) {
    socket.join(`conv:${conversation_id}`);
  }
  q.run("UPDATE users SET last_seen = datetime('now') WHERE id = ?", uid);
  socket.on('typing', ({ conversation_id, name }) => {
    if (q.get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', conversation_id, uid)) {
      socket.to(`conv:${conversation_id}`).emit('typing', { conversation_id, user_id: uid, name });
    }
  });
});

// Close out finished events hourly so participants get their feedback survey.
setInterval(completePastActivities, 60 * 60 * 1000);

const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => console.log(`Campus Connect API on http://localhost:${PORT}`));
