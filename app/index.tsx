import { useApp } from '@/core/AppProvider';
import { ErrorState, LoadingState } from '@/shared/components/ui';
import { useQuery } from '@/shared/hooks/useQuery';
import { Redirect } from 'expo-router';
export default function Index() {
  const { repo } = useApp();
  const { data, loading, error, reload } = useQuery(
    () => repo.setting('onboarding_complete'),
    [repo],
  );
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return <Redirect href={data === '1' ? '/(tabs)' : '/onboarding'} />;
}
