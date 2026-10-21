import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, type = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>
            {t.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
