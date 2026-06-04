import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DemoContextValue = {
  /** Quand activé, le parcours de chasse est jouable sans vraie géolocalisation (démo / mock). */
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  toggleDemo: () => void;
};

const STORAGE_KEY = 'lootopia-mobile-demo-mode';

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoModeState] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        setDemoModeState(true);
      }
    })();
  }, []);

  const setDemoMode = (value: boolean) => {
    setDemoModeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false').catch(() => {});
  };

  const value = useMemo<DemoContextValue>(
    () => ({
      demoMode,
      setDemoMode,
      toggleDemo: () => setDemoMode(!demoMode),
    }),
    [demoMode]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within DemoProvider');
  }

  return context;
}
