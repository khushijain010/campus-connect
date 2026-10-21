import { io } from 'socket.io-client';

let socket = null;
const listeners = new Set();

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
  listeners.forEach((fn) => fn(socket));
  return socket;
}

export const getSocket = () => socket;

// Subscribe to a socket event; re-binds automatically if the socket reconnects with a new token.
export function onSocket(event, handler) {
  const bind = (s) => s.on(event, handler);
  if (socket) bind(socket);
  listeners.add(bind);
  return () => { listeners.delete(bind); socket?.off(event, handler); };
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
