import { AppProvider } from '@/core/AppProvider';
import { brand } from '@/core/config/brand';
import { LockGate } from '@/core/security/LockGate';
import { colors } from '@/core/theme/tokens';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppProvider>
          <LockGate>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.background },
                headerTitle: brand.name,
                headerBackTitle: 'Atrás',
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            </Stack>
          </LockGate>
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
