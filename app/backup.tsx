import { useApp } from '@/core/AppProvider';
import { errorMessage } from '@/core/errors/AppError';
import { createBackup, inspectBackup, restoreBackup } from '@/features/backup/backup';
import { AppButton, AppCard, confirm, Screen } from '@/shared/components/ui';
import * as DocumentPicker from 'expo-document-picker';
import { usePreventRemove } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { Alert, Text } from 'react-native';
export default function Backup() {
  const { db, repo, demo, refresh } = useApp();
  const [busy, setBusy] = React.useState(false);
  usePreventRemove(busy, () =>
    Alert.alert(
      'Operación en curso',
      'Espera a que termine el respaldo o restauración antes de salir.',
    ),
  );
  const [uri, setUri] = React.useState('');
  const [inspection, setInspection] = React.useState<Awaited<ReturnType<typeof inspectBackup>>>();
  const [last, setLast] = React.useState('');
  React.useEffect(() => {
    void repo
      .setting('last_backup')
      .then((v) => setLast(v ?? 'Todavía no hay copias'))
      .catch((e) => Alert.alert('No se pudo consultar', errorMessage(e)));
  }, [repo]);
  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (e) {
      Alert.alert('No se pudo completar', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Copias de seguridad"
      subtitle={demo ? 'Respaldos de demostración' : 'Tus datos reales'}
    >
      <AppCard>
        <Text>
          Los respaldos contienen información personal y financiera. No están cifrados. Compártelos
          solo con personas de confianza y guarda una copia fuera de este dispositivo.
        </Text>
        <Text>Última copia: {last}</Text>
        <Text>
          Formato portable con datos, fotografías, documentos y manifiesto de integridad. Límite: 80
          MB por copia.
        </Text>
      </AppCard>
      <AppButton
        title="Crear y compartir respaldo"
        loading={busy}
        onPress={() => {
          void run(async () => {
            const file = await createBackup(db, repo, demo);
            setLast(new Date().toISOString());
            refresh();
            if (!(await Sharing.isAvailableAsync()))
              throw new Error(
                'La copia quedó guardada localmente, pero no hay opciones de compartir disponibles.',
              );
            await Sharing.shareAsync(file, {
              mimeType: 'application/json',
              dialogTitle: 'Guardar copia de seguridad',
            });
          });
        }}
      />
      <AppButton
        title="Seleccionar y validar respaldo"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          void run(async () => {
            const result = await DocumentPicker.getDocumentAsync({
              type: ['application/json', 'application/octet-stream'],
              copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            const file = result.assets[0];
            if (!file) return;
            const value = await inspectBackup(db, file.uri);
            setUri(file.uri);
            setInspection(value);
          });
        }}
      />
      {inspection && (
        <AppCard>
          <Text>Generado: {inspection.createdAt}</Text>
          <Text>
            Origen: {inspection.mode === 'demo' ? 'Demostración' : 'Datos reales'} ·
            {inspection.count} documentos
          </Text>
          <Text>
            La estructura, los saldos, las relaciones y las huellas digitales han sido validados.
          </Text>
          <AppButton
            title="Restaurar esta copia"
            variant="danger"
            loading={busy}
            onPress={() =>
              confirm(
                'Reemplazar datos actuales',
                'Se creará una copia previa recuperable. La restauración reemplazará los datos y documentos del modo actual. Mantén la aplicación abierta hasta que termine.',
                () =>
                  run(async () => {
                    await restoreBackup(db, repo, uri, demo);
                    refresh();
                    setInspection(undefined);
                    Alert.alert(
                      'Restauración completada',
                      'Los datos y documentos quedaron restaurados.',
                    );
                  }),
              )
            }
          />
        </AppCard>
      )}
    </Screen>
  );
}
