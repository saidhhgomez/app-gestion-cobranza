import { errorMessage } from '@/core/errors/AppError';
import { useCallback, useEffect, useRef, useState } from 'react';
export function useQuery<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve()
      .then(() => {
        if (mounted) {
          setLoading(true);
          setError(undefined);
        }
        return loaderRef.current();
      })
      .then((value) => {
        if (mounted) setData(value);
      })
      .catch((e) => {
        if (mounted) setError(errorMessage(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [...deps, counter]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setCounter((c) => c + 1), []);
  return { data, loading, error, reload };
}
