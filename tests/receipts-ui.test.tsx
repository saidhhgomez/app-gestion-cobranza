import type { Repository } from '@/core/contracts';
import { openDatabase } from '@/core/database/database';
import { createRepository } from '@/core/database/repository';
import ReceiptScreen from '@/features/receipts/ReceiptScreen';
import { currentPeriod } from '@/shared/formatting';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PaymentForm from '../app/payment';
import { clean, initialize } from './support/nativeAdapters';
let mockRepo: Repository;
let mockProperty = '';
let mockParams: Record<string, string> = { id: 'new' };
const mockRefresh = jest.fn();
jest.mock('@/core/AppProvider', () => ({
  useApp: () => ({
    repo: mockRepo,
    propertyId: mockProperty,
    setPropertyId: jest.fn(),
    period: require('@/shared/formatting').currentPeriod(),
    revision: 0,
    refresh: mockRefresh,
    demo: false,
  }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  usePreventRemove: jest.fn(),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-sqlite', () => require('./support/nativeAdapters').sqlite);
jest.mock('expo-file-system', () => require('./support/nativeAdapters').fileSystem);
jest.mock('expo-crypto', () => require('./support/nativeAdapters').nativeCrypto);
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-print', () => ({}));
const wrap = (child: React.ReactNode) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {child}
  </SafeAreaProvider>
);
beforeAll(async () => {
  await initialize();
  mockRepo = createRepository(await openDatabase());
  mockProperty = await mockRepo.saveProperty({
    name: 'Casa del flujo',
    address: 'Lima',
    district: 'Lima',
    province: 'Lima',
    region: 'Lima',
    kind: 'Casa',
    description: '',
    active: 1,
  });
  const unit = await mockRepo.saveUnit({
    property_id: mockProperty,
    code: '101',
    name: 'Unidad 101',
    floor: '1',
    kind: 'Departamento',
    description: '',
    notes: '',
    active: 1,
  });
  const person = await mockRepo.savePerson({
    first_name: 'Ana',
    last_name: 'Prueba',
    document_type: 'Otro',
    document_number: '',
    phone: '',
    email: '',
    notes: '',
    active: 1,
  });
  const occupancy = await mockRepo.saveOccupancy({
    unit_id: unit,
    person_id: person,
    kind: 'INQUILINO',
    start_date: `${currentPeriod()}-01`,
    end_date: null,
    inhabitants: 1,
    rent_cents: 10000,
    due_day: 5,
    notes: '',
  });
  const service = await mockRepo.saveService({
    property_id: mockProperty,
    name: 'Internet',
    unit: '',
    supports_meter: 0,
    uses_receipt: 1,
    allows_independent: 1,
    criterion: 'EQUITATIVO',
    active: 1,
  });
  await mockRepo.saveConfig({
    occupancy_id: occupancy,
    service_id: service,
    mode: 'PRORRATEO',
    fixed_cents: 0,
    independent: 0,
    effective_from: `${currentPeriod()}-01`,
    effective_to: null,
  });
});
afterAll(clean);
test('asistente de factura usa persistencia y confirma el cobro real', async () => {
  mockParams = { id: 'new' };
  const screen = await render(wrap(<ReceiptScreen />));
  await waitFor(() => expect(screen.getByText('Internet')).toBeTruthy());
  await fireEvent.press(screen.getByText('Internet'));
  await fireEvent.press(screen.getByText('Siguiente: datos del recibo'));
  await fireEvent.changeText(screen.getByLabelText('Empresa proveedora'), 'Proveedor local');
  await fireEvent.changeText(screen.getByLabelText('Importe total de la factura (S/)'), '40.00');
  await fireEvent.press(screen.getByText('Guardar borrador y continuar'));
  await waitFor(() => expect(screen.getByText('Siguiente: participantes y lecturas')).toBeTruthy());
  await fireEvent.press(screen.getByText('Siguiente: participantes y lecturas'));
  await fireEvent.press(screen.getByText('Guardar lecturas y ver reparto'));
  await waitFor(() => expect(screen.getByText('Finalizar recibo')).toBeTruthy());
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await fireEvent.press(screen.getByText('Finalizar recibo'));
  alert.mock.calls.at(-1)?.[2]?.[1]?.onPress?.();
  await waitFor(async () =>
    expect((await mockRepo.receipts(mockProperty))[0]?.status).toBe('FINALIZADO'),
  );
  expect((await mockRepo.charges(mockProperty))[0]?.amount_cents).toBe(4000);
  alert.mockRestore();
  await screen.unmount();
});
test('formulario registra abono parcial y actualiza saldo SQLite', async () => {
  const charge = (await mockRepo.charges(mockProperty))[0]!;
  mockParams = { occupancy: charge.occupancy_id, property: mockProperty };
  const screen = await render(wrap(<PaymentForm />));
  await waitFor(() => expect(screen.getByText('Ana Prueba · Departamento 101')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Pago recibido (S/)'), '10.00');
  await fireEvent.press(screen.getByText('Sugerir reparto: deuda más antigua primero'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await fireEvent.press(screen.getByText('Confirmar pago recibido'));
  alert.mock.calls.at(-1)?.[2]?.[1]?.onPress?.();
  await waitFor(async () =>
    expect((await mockRepo.charges(mockProperty))[0]?.balance_cents).toBe(3000),
  );
  expect(mockRefresh).toHaveBeenCalled();
  alert.mockRestore();
  await screen.unmount();
});
test('borrador temporal recupera campos sin confirmar al reabrir el asistente', async () => {
  mockParams = { id: 'new' };
  const first = await render(wrap(<ReceiptScreen />));
  await waitFor(() => expect(first.getByText('Internet')).toBeTruthy());
  await fireEvent.press(first.getByText('Internet'));
  await fireEvent.press(first.getByText('Siguiente: datos del recibo'));
  await fireEvent.changeText(first.getByLabelText('Empresa proveedora'), 'Borrador recuperable');
  await fireEvent.changeText(first.getByLabelText('Importe total de la factura (S/)'), '12.50');
  await waitFor(async () =>
    expect(await mockRepo.setting('receipt-edit:new')).toContain('Borrador recuperable'),
  );
  await first.unmount();
  const resumed = await render(wrap(<ReceiptScreen />));
  await waitFor(() => expect(resumed.getByDisplayValue('Borrador recuperable')).toBeTruthy());
  expect(resumed.getByDisplayValue('12.50')).toBeTruthy();
  await resumed.unmount();
  await mockRepo.setSetting('receipt-edit:new', '');
});
