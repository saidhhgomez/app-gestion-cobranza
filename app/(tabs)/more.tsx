import { useApp } from '@/core/AppProvider';
import { AppButton, AppCard, Screen } from '@/shared/components/ui';
import { router, type Href } from 'expo-router';
import { Text } from 'react-native';
export default function More() {
  const { demo } = useApp();
  return (
    <Screen title="Todo a tu alcance" subtitle="Organiza tus inmuebles a tu ritmo.">
      {demo && (
        <AppCard>
          <Text>Modo demostración. Estos datos están separados de tus inmuebles reales.</Text>
        </AppCard>
      )}
      {[
        ['Mis inmuebles', '/properties'],
        ['Departamentos', '/units'],
        ['Inquilinos y propietarios', '/people'],
        ['Ocupaciones y alquileres', '/occupancies'],
        ['Servicios', '/services'],
        ['Medidores', '/meters'],
        ['Pagos recibidos', '/payments'],
        ['Reportes', '/reports'],
        ['Copias de seguridad', '/backup'],
        ['Configuración', '/settings'],
        ['Ayuda', '/help'],
      ].map(([label, path]) => (
        <AppButton
          key={path}
          title={label!}
          variant="secondary"
          onPress={() => router.push(path as Href)}
        />
      ))}
    </Screen>
  );
}
