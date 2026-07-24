import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'credopass:premium';

interface PremiumContextValue {
  /** Whether the current user has a premium entitlement. */
  isPremium: boolean;
  setPremium: (value: boolean) => void;
  togglePremium: () => void;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

const readStored = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Premium entitlement, as a single boolean.
 *
 * There is no billing backend yet, so the value is local and flipped by hand
 * from Profile — that is the point for now, it lets any account be made premium
 * for testing. When real entitlements land, this provider is the only thing that
 * needs to change; every consumer just reads `isPremium`.
 */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState<boolean>(readStored);

  const setPremium = useCallback((value: boolean) => {
    setIsPremium(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* Storage unavailable — the toggle still works for this session. */
    }
  }, []);

  const togglePremium = useCallback(() => setPremium(!isPremium), [isPremium, setPremium]);

  const value = useMemo(
    () => ({ isPremium, setPremium, togglePremium }),
    [isPremium, setPremium, togglePremium]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
}
