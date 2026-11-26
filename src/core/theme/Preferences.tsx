import type { Repository } from '@/core/contracts';
import React, { createContext, useContext, useEffect, useState } from 'react';
const Preferences = createContext({ largeText: false });
export function VisualPreferencesProvider({
  repo,
  revision,
  children,
}: {
  repo: Repository;
  revision: number;
  children: React.ReactNode;
}) {
  const [largeText, setLargeText] = useState(false);
  useEffect(() => {
    let active = true;
    void repo
      .setting('large_text')
      .then((v) => {
        if (active) setLargeText(v === '1');
      })
      .catch(() => {
        if (active) setLargeText(false);
      });
    return () => {
      active = false;
    };
  }, [repo, revision]);
  return <Preferences.Provider value={{ largeText }}>{children}</Preferences.Provider>;
}
export const useVisualPreferences = () => useContext(Preferences);
