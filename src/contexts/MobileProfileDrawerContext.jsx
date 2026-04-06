import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const MobileProfileDrawerContext = createContext(null);

export function MobileProfileDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  const value = useMemo(
    () => ({ open, setOpen, close, toggle }),
    [open, close, toggle]
  );

  return (
    <MobileProfileDrawerContext.Provider value={value}>
      {children}
    </MobileProfileDrawerContext.Provider>
  );
}

export function useMobileProfileDrawer() {
  const ctx = useContext(MobileProfileDrawerContext);
  if (!ctx) {
    return {
      open: false,
      setOpen: () => {},
      close: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
