import { seedDemo } from '@/features/demo/seed';
import { ErrorState, LoadingState } from '@/shared/components/ui';
import { currentPeriod } from '@/shared/formatting';
import type { SQLiteDatabase } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Repository } from './contracts';
import { openDatabase } from './database/database';
import { createRepository } from './database/repository';
import { errorMessage } from './errors/AppError';
import { reconcileAttachmentStore } from './storage/attachments';
import { VisualPreferencesProvider } from './theme/Preferences';

interface AppContextValue {
  repo: Repository;
  db: SQLiteDatabase;
  propertyId: string;
  setPropertyId: (id: string) => void;
  period: string;
  setPeriod: (value: string) => void;
  refresh: () => void;
  revision: number;
  demo: boolean;
  switchDemo: (enabled: boolean) => Promise<void>;
}
const Context = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<{ db: SQLiteDatabase; repo: Repository }>();
  const [error, setError] = useState<string>();
  const [demo, setDemo] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  const load = useCallback(
    async (isDemo: boolean) => {
      setError(undefined);
      const db = await openDatabase(isDemo);
      await reconcileAttachmentStore(db, isDemo);
      const repo = createRepository(db);
      if (isDemo) await seedDemo(repo);
      setDatabase({ db, repo });
      setDemo(isDemo);
      setPropertyId('');
      refresh();
    },
    [refresh],
  );
  useEffect(() => {
    void Promise.resolve()
      .then(() => load(false))
      .catch((e) => setError(errorMessage(e)));
  }, [load]);
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void Promise.resolve()
            .then(() => load(false))
            .catch((e) => setError(errorMessage(e)));
        }}
      />
    );
  if (!database) return <LoadingState />;
  return (
    <Context.Provider
      value={{
        ...database,
        propertyId,
        setPropertyId,
        period,
        setPeriod,
        refresh,
        revision,
        demo,
        switchDemo: load,
      }}
    >
      <VisualPreferencesProvider repo={database.repo} revision={revision}>
        {children}
      </VisualPreferencesProvider>
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('No se ha iniciado el almacenamiento.');
  return value;
}
