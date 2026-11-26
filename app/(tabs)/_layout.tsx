import { colors } from '@/core/theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { minHeight: 65, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 13 },
      }}
    >
      {(['index', 'receipts', 'charges', 'more'] as const).map((name, i) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: ['Inicio', 'Recibos', 'Cobros', 'Más'][i],
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={
                  (
                    [
                      'home-outline',
                      'document-text-outline',
                      'wallet-outline',
                      'grid-outline',
                    ] as const
                  )[i]
                }
                color={typeof color === 'string' ? color : colors.primary}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
