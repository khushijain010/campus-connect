import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import { connectSocket, disconnectSocket, onSocket } from './socket.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ready, setReady] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  const logout = useCallback(() => {
    setToken(null);
    disconnectSocket();
    setUser(null);
  }, []);

  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  const refreshUnread = useCallback(() => {
    api.get('/chats/unread').then((r) => setUnreadChats(r.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/meta').then(setMeta).catch(() => {});
    if (!getToken()) { setReady(true); return; }
    api.get('/auth/me')
      .then((r) => { setUser(r.user); connectSocket(getToken()); })
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    refreshUnread();
    return onSocket('unread', refreshUnread);
  }, [user?.id, refreshUnread]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.token);
    connectSocket(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const value = useMemo(() => ({
    user, setUser, meta, ready, login, logout, unreadChats, refreshUnread, options: meta?.options,
  }), [user, meta, ready, login, logout, unreadChats, refreshUnread]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
