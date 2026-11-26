import { RecordForm } from '@/shared/components/RecordForm';
import { AppButton, DateField, EmptyState, confirm } from '@/shared/components/ui';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const wrap = (child: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={metrics}>{child}</SafeAreaProvider>
);
test('botón accesible y prevención de doble envío en estado ocupado', async () => {
  const fn = jest.fn();
  const screen = await render(<AppButton title="Confirmar pago" onPress={fn} loading />);
  await fireEvent.press(screen.getByLabelText('Confirmar pago'));
  expect(fn).not.toHaveBeenCalled();
});
test('estado vacío muestra una acción comprensible', async () => {
  const screen = await render(
    <EmptyState title="Todavía no hay recibos" description="Registra la primera factura." />,
  );
  expect(screen.getByText('Todavía no hay recibos')).toBeTruthy();
});
test('fecha visual peruana se convierte a fecha de negocio ISO', async () => {
  const fn = jest.fn();
  const screen = await render(<DateField label="Ingreso" value="2026-11-25" onChange={fn} />);
  expect(screen.getByDisplayValue('25/11/2026')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Ingreso (DD/MM/AAAA)'), '30/11/2026');
  expect(fn).toHaveBeenCalledWith('2026-11-30');
});
test('formulario valida antes de guardar y muestra error debajo', async () => {
  const fn = jest.fn().mockResolvedValue(undefined);
  const screen = await render(
    wrap(
      <RecordForm
        fields={[{ name: 'name', label: 'Nombre del inmueble', required: true }]}
        onSave={fn}
      />,
    ),
  );
  await fireEvent.press(screen.getByText('Guardar'));
  await waitFor(() => expect(screen.getByText('Este campo es obligatorio.')).toBeTruthy());
  expect(fn).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Nombre del inmueble'), 'Casa Lima');
  await fireEvent.press(screen.getByText('Guardar'));
  await waitFor(() => expect(fn).toHaveBeenCalledWith({ name: 'Casa Lima' }));
});
test('confirmación no ejecuta una operación antes de confirmarla', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const fn = jest.fn();
  confirm('Anular pago', 'Se restablecerá el saldo.', fn);
  expect(fn).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]?.[2];
  buttons?.[1]?.onPress?.();
  await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
  alert.mockRestore();
});
