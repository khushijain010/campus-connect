// Thin wrapper so routes can emit events without depending on socket.io directly (no-op in tests).
let io = null;
export const setIo = (instance) => { io = instance; };
export const emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);
export const emitToConversation = (convId, event, payload) => io?.to(`conv:${convId}`).emit(event, payload);
export const joinConversation = (userId, convId) => io?.in(`user:${userId}`).socketsJoin(`conv:${convId}`);
export const leaveConversation = (userId, convId) => io?.in(`user:${userId}`).socketsLeave(`conv:${convId}`);
