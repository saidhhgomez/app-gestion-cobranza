import { useApp } from '@/core/AppProvider';
import type { Distribution, Participant, Receipt, ReceiptInput } from '@/core/contracts';
import { errorMessage } from '@/core/errors/AppError';
import { pickAttachment, removeAttachment, shareAttachment } from '@/core/storage/attachments';
import { exportPdf } from '@/features/reports/pdf';
import { PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  AppInput,
  CurrencyInput,
  DateField,
  DecimalInput,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
  StatusBadge,
  StepIndicator,
  confirm,
  styles,
} from '@/shared/components/ui';
import { money, scaled, today, unscale } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';
import { parseReceiptDraft } from './draft';
const blank = (propertyId: string, period: string): ReceiptInput => ({
  property_id: propertyId,
  period,
  service_id: '',
  provider: '',
  supply_number: '',
  receipt_number: '',
  total_cents: 0,
  total_consumption: null,
  issued_on: today(),
  due_on: today(),
  consumption_start: null,
  consumption_end: null,
  notes: '',
});
const finalizedState = (record: Receipt | null) =>
  !!record && (record.status === 'FINALIZADO' || record.status === 'ANULADO');
export default function ReceiptScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const { repo, propertyId, setPropertyId, period, refresh, revision, demo } = useApp();
  const [id, setId] = React.useState(routeId === 'new' ? '' : routeId);
  const [step, setStep] = React.useState(1);
  const [input, setInput] = React.useState<ReceiptInput>(() => blank(propertyId, period));
  const [record, setRecord] = React.useState<Receipt | null>(null);
  const [amount, setAmount] = React.useState('');
  const [consumption, setConsumption] = React.useState('');
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [readings, setReadings] = React.useState<
    Record<string, { previous: string; current: string }>
  >({});
  const [distribution, setDistribution] = React.useState<Distribution>();
  const [assumeOwner, setAssumeOwner] = React.useState(false);
  const [reviewed, setReviewed] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [localError, setLocalError] = React.useState('');
  const [allowLeave, setAllowLeave] = React.useState(false);
  const [draftReady, setDraftReady] = React.useState(false);
  const services = useQuery(
    () => (input.property_id ? repo.services(input.property_id) : Promise.resolve([])),
    [repo, input.property_id, revision],
  );
  const units = useQuery(
    () => (input.property_id ? repo.units(input.property_id) : Promise.resolve([])),
    [repo, input.property_id, revision],
  );
  const load = useQuery(async () => {
    if (!id) {
      if (!draftReady) {
        const draft = parseReceiptDraft(await repo.setting('receipt-edit:new'));
        if (draft) {
          setInput(draft.input);
          setPropertyId(draft.input.property_id);
          setAmount(draft.amount);
          setConsumption(draft.consumption);
          setStep(Math.min(draft.step, 2));
        }
        setDraftReady(true);
      }
      return null;
    }
    const value = {
      receipt: await repo.receipt(id),
      participants: await repo.receiptParticipants(id),
    };
    if (value.receipt) {
      const r = value.receipt;
      setRecord(r);
      setInput(r);
      setAmount(unscale(r.total_cents));
      setConsumption(r.total_consumption === null ? '' : unscale(r.total_consumption, 3));
      setParticipants(value.participants);
      setReadings(
        Object.fromEntries(
          value.participants.map((p) => [
            p.id,
            {
              previous: p.previous_reading === null ? '' : unscale(p.previous_reading, 3),
              current: p.current_reading === null ? '' : unscale(p.current_reading, 3),
            },
          ]),
        ),
      );
      setStep(r.status === 'FINALIZADO' || r.status === 'ANULADO' ? 6 : 3);
      if (!draftReady && !finalizedState(r)) {
        const draft = parseReceiptDraft(await repo.setting(`receipt-edit:${id}`));
        if (draft) {
          setInput({
            ...r,
            ...draft.input,
            id: r.id,
            property_id: r.property_id,
            service_id: r.service_id,
            period: r.period,
          });
          setAmount(draft.amount);
          setConsumption(draft.consumption);
          setReadings(draft.readings);
          setParticipants(
            value.participants.map((p) => {
              const saved = draft.participants.find((row) => row.id === p.id);
              return saved
                ? { ...p, inhabitants: saved.inhabitants, excluded_reason: saved.excluded_reason }
                : p;
            }),
          );
          setStep(draft.step);
        }
      }
      setDraftReady(true);
    }
    return value;
  }, [repo, id, revision]);
  React.useEffect(() => {
    if (!id)
      void Promise.resolve().then(() => setInput((v) => ({ ...v, property_id: propertyId })));
  }, [propertyId, id]);

  const attachments = useQuery(
    () => (id ? repo.attachments(id) : Promise.resolve([])),
    [repo, id, revision],
  );
  const finalized = record?.status === 'FINALIZADO' || record?.status === 'ANULADO';
  React.useEffect(() => {
    if (!draftReady || finalized || step > 5) return;
    const timer = setTimeout(() => {
      void repo
        .setSetting(
          `receipt-edit:${id || 'new'}`,
          JSON.stringify({
            input,
            amount,
            consumption,
            step,
            readings,
            participants: participants.map((p) => ({
              id: p.id,
              inhabitants: p.inhabitants,
              excluded_reason: p.excluded_reason,
            })),
          }),
        )
        .catch((e) => setLocalError(errorMessage(e)));
    }, 350);
    return () => clearTimeout(timer);
  }, [repo, id, input, amount, consumption, step, readings, participants, draftReady, finalized]);
  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setLocalError('');
    try {
      await task();
    } catch (e) {
      setLocalError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const parsedParticipants = () =>
    participants.map((p) => ({
      ...p,
      previous_reading: readings[p.id]?.previous ? scaled(readings[p.id]!.previous, 3) : null,
      current_reading: readings[p.id]?.current ? scaled(readings[p.id]!.current, 3) : null,
    }));
  const saveData = async () => {
    const newId = await repo.saveReceipt({
      ...input,
      id: id || undefined,
      total_cents: scaled(amount),
      total_consumption: consumption ? scaled(consumption, 3) : null,
    });
    if (!id) {
      await repo.setSetting('receipt-edit:new', '');
      setId(newId);
      const ps = await repo.receiptParticipants(newId);
      setParticipants(ps);
      setReadings(
        Object.fromEntries(
          ps.map((p) => [
            p.id,
            {
              previous: p.previous_reading === null ? '' : unscale(p.previous_reading, 3),
              current: p.current_reading === null ? '' : unscale(p.current_reading, 3),
            },
          ]),
        ),
      );
    }
    setStep(3);
    refresh();
  };
  const preview = async () => {
    if (participants.some((p) => p.partial_period) && !reviewed)
      throw new Error(
        'Confirma que revisaste los participantes que ingresaron o salieron durante el periodo.',
      );
    await repo.saveParticipants(id, parsedParticipants());
    setDistribution(await repo.previewReceipt(id, assumeOwner));
    setStep(5);
  };
  usePreventRemove(
    !allowLeave && (busy || (!finalizedState(record) && (step === 2 || step === 4))),
    ({ repeat }) => {
      if (busy) {
        Alert.alert('Operación en curso', 'Espera a que termine para salir de esta pantalla.');
        return;
      }
      Alert.alert(
        'Guardar antes de salir',
        'Puedes conservar el borrador para continuar más adelante.',
        [
          { text: 'Seguir editando', style: 'cancel' },
          {
            text: 'Descartar cambios de esta pantalla',
            style: 'destructive',
            onPress: () => {
              void repo
                .setSetting(`receipt-edit:${id || 'new'}`, '')
                .then(() => {
                  setAllowLeave(true);
                  repeat();
                })
                .catch((e) => setLocalError(errorMessage(e)));
            },
          },
          {
            text: 'Guardar borrador y salir',
            onPress: () => {
              setBusy(true);
              void (step === 2 ? saveData() : repo.saveParticipants(id, parsedParticipants()))
                .then(() => {
                  setAllowLeave(true);
                  repeat();
                })
                .catch((e) => setLocalError(errorMessage(e)))
                .finally(() => setBusy(false));
            },
          },
        ],
      );
    },
  );
  return (
    <Screen
      title={finalized ? 'Detalle de la factura' : 'Registrar factura del inmueble'}
      subtitle="Los documentos son opcionales. Los datos se registran manualmente."
    >
      <StepIndicator current={step} total={6} />
      {load.loading && id && <LoadingState />}
      {load.error && <ErrorState message={load.error} onRetry={load.reload} />}
      {!!localError && <ErrorState message={localError} />}
      {record && <StatusBadge label={record.status} />}
      {step === 1 && (
        <>
          <PropertySelector allowAll={false} />
          <SelectField
            label="Servicio"
            value={input.service_id}
            onChange={(v) => setInput((i) => ({ ...i, service_id: v }))}
            options={(services.data ?? [])
              .filter((s) => s.active && s.uses_receipt)
              .map((s) => ({ label: s.name, value: s.id }))}
          />
          {services.data?.length === 0 && (
            <EmptyState
              title="Habilita un servicio primero"
              description="Puedes crear Luz, Agua u otro servicio desde Más → Servicios."
            />
          )}
          <AppInput
            label="Periodo (AAAA-MM)"
            value={input.period}
            onChangeText={(v) => setInput((i) => ({ ...i, period: v }))}
          />
          <AppButton
            title="Siguiente: datos del recibo"
            disabled={!input.property_id || !input.service_id}
            onPress={() => setStep(2)}
          />
        </>
      )}
      {step === 2 && (
        <>
          <AppInput
            label="Empresa proveedora"
            value={input.provider}
            onChangeText={(v) => setInput((i) => ({ ...i, provider: v }))}
          />
          <AppInput
            label="Número de suministro (opcional)"
            value={input.supply_number}
            onChangeText={(v) => setInput((i) => ({ ...i, supply_number: v }))}
          />
          <AppInput
            label="Número de recibo (opcional)"
            value={input.receipt_number}
            onChangeText={(v) => setInput((i) => ({ ...i, receipt_number: v }))}
          />
          <CurrencyInput
            label="Importe total de la factura (S/)"
            value={amount}
            onChangeText={setAmount}
          />
          <DecimalInput
            label="Consumo total (hasta 3 decimales, opcional sin medidores)"
            value={consumption}
            onChangeText={setConsumption}
          />
          <DateField
            label="Fecha de emisión"
            value={input.issued_on}
            onChange={(v) => setInput((i) => ({ ...i, issued_on: v }))}
          />
          <DateField
            label="Fecha de vencimiento"
            value={input.due_on}
            onChange={(v) => setInput((i) => ({ ...i, due_on: v }))}
          />
          <DateField
            label="Inicio del consumo (opcional)"
            value={input.consumption_start ?? ''}
            onChange={(v) => setInput((i) => ({ ...i, consumption_start: v || null }))}
          />
          <DateField
            label="Fin del consumo (opcional)"
            value={input.consumption_end ?? ''}
            onChange={(v) => setInput((i) => ({ ...i, consumption_end: v || null }))}
          />
          <AppInput
            label="Observaciones"
            value={input.notes}
            onChangeText={(v) => setInput((i) => ({ ...i, notes: v }))}
          />
          <AppButton
            title="Guardar borrador y continuar"
            loading={busy}
            onPress={() => {
              void run(saveData);
            }}
          />
          <AppButton title="Atrás" variant="secondary" onPress={() => setStep(1)} />
        </>
      )}
      {step === 3 && (
        <>
          <Text style={styles.cardTitle}>Documentos y fotografías</Text>
          <Text>
            Los archivos se copian al almacenamiento privado de la aplicación. La cámara se utiliza
            solo si decides tomar una fotografía.
          </Text>
          {(['camera', 'gallery', 'document'] as const).map((kind, i) => (
            <AppButton
              key={kind}
              title={['Tomar fotografía', 'Seleccionar imagen', 'Seleccionar PDF o imagen'][i]!}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                void run(async () => {
                  await pickAttachment(repo, id, demo, kind);
                  refresh();
                });
              }}
            />
          ))}
          {attachments.data?.map((a) => (
            <AppCard key={a.id}>
              <Text>{a.name}</Text>
              {a.meter_id && (
                <Text>
                  Foto de lectura · Departamento{' '}
                  {participants.find((p) => p.meter_id === a.meter_id)?.unit_code}
                </Text>
              )}
              <AppButton
                title="Abrir opciones para compartir"
                variant="secondary"
                onPress={() => {
                  void run(() => shareAttachment(a, demo));
                }}
              />
              <AppButton
                title="Eliminar adjunto del borrador"
                variant="danger"
                onPress={() =>
                  confirm('Eliminar adjunto', 'Se quitará este documento del borrador.', () =>
                    run(async () => {
                      await removeAttachment(repo, a, demo);
                      refresh();
                    }),
                  )
                }
              />
            </AppCard>
          ))}
          <AppButton title="Siguiente: participantes y lecturas" onPress={() => setStep(4)} />
          <AppButton
            title="Editar datos del recibo"
            variant="secondary"
            onPress={() => setStep(2)}
          />
        </>
      )}
      {step === 4 && (
        <>
          {units.data
            ?.filter((u) => !participants.some((p) => p.unit_id === u.id))
            .map((u) => (
              <AppCard key={u.id}>
                <Text>{u.code} · Excluido: sin ocupación aplicable a este periodo.</Text>
              </AppCard>
            ))}
          <Text>
            Revisa quién participó en este periodo. Los departamentos desocupados y servicios no
            aplicables quedan excluidos. Un cambio de habitantes a mitad del mes requiere confirmar
            la cantidad aplicable.
          </Text>
          {participants.length === 0 && (
            <EmptyState
              title="Sin ocupaciones aplicables"
              description="Puedes confirmar que el propietario asuma toda la factura."
            />
          )}
          {participants.map((p) => (
            <AppCard key={p.id}>
              <Text style={styles.cardTitle}>
                {p.unit_code} · {p.person_name}
              </Text>
              <Text>
                {p.kind} · {p.mode} · {p.inhabitants} habitantes
              </Text>
              {p.excluded_reason && <Text>Excluido: {p.excluded_reason}</Text>}
              {p.partial_period && (
                <Text>
                  Revisar ingreso, salida o cambio dentro del mes. No hay prorrateo automático por
                  días.
                </Text>
              )}
              {!p.excluded_reason && p.mode === 'PRORRATEO' && (
                <AppInput
                  label="Habitantes aplicables al reparto"
                  keyboardType="number-pad"
                  value={String(p.inhabitants)}
                  onChangeText={(v) =>
                    setParticipants((ps) =>
                      ps.map((row) => (row.id === p.id ? { ...row, inhabitants: Number(v) } : row)),
                    )
                  }
                />
              )}
              {!p.excluded_reason && p.mode === 'FIJO' && (
                <Text>Importe fijo {money(p.fixed_cents)}</Text>
              )}
              {!p.excluded_reason && p.mode === 'MEDIDOR' && (
                <>
                  <Text>
                    Las lecturas pertenecen al medidor de esta unidad y servicio. Conserva la
                    lectura precargada; si necesita una corrección, documenta el motivo en
                    observaciones.
                  </Text>
                  <DecimalInput
                    label="Lectura anterior"
                    value={readings[p.id]?.previous ?? ''}
                    onChangeText={(v) =>
                      setReadings((r) => ({
                        ...r,
                        [p.id]: { previous: v, current: r[p.id]?.current ?? '' },
                      }))
                    }
                  />
                  <DecimalInput
                    label="Lectura actual"
                    value={readings[p.id]?.current ?? ''}
                    onChangeText={(v) =>
                      setReadings((r) => ({
                        ...r,
                        [p.id]: { previous: r[p.id]?.previous ?? '', current: v },
                      }))
                    }
                  />
                  {p.meter_id && (
                    <>
                      <AppButton
                        title="Fotografiar este medidor (opcional)"
                        variant="secondary"
                        disabled={busy}
                        onPress={() => {
                          void run(async () => {
                            await pickAttachment(repo, id, demo, 'camera', p.meter_id!);
                            attachments.reload();
                          });
                        }}
                      />
                      <AppButton
                        title="Adjuntar imagen de esta lectura"
                        variant="secondary"
                        disabled={busy}
                        onPress={() => {
                          void run(async () => {
                            await pickAttachment(repo, id, demo, 'gallery', p.meter_id!);
                            attachments.reload();
                          });
                        }}
                      />
                    </>
                  )}
                </>
              )}
              {!p.excluded_reason && (
                <AppButton
                  title="Excluir de este recibo"
                  variant="secondary"
                  onPress={() =>
                    confirm(
                      'Excluir participante',
                      'Confirma que esta ocupación no debe participar en este recibo.',
                      () =>
                        setParticipants((ps) =>
                          ps.map((row) =>
                            row.id === p.id
                              ? {
                                  ...row,
                                  excluded_reason: 'Exclusión revisada por la administración',
                                }
                              : row,
                          ),
                        ),
                    )
                  }
                />
              )}
            </AppCard>
          ))}
          <AppButton
            title={
              reviewed
                ? '✓ Participantes especiales revisados'
                : 'Confirmar participantes e ingresos/salidas del mes'
            }
            variant="secondary"
            onPress={() => setReviewed((v) => !v)}
          />
          <AppButton
            title={
              assumeOwner
                ? '✓ El propietario asumirá el saldo sin prorrateo'
                : 'Permitir que el propietario asuma el saldo sin prorrateo'
            }
            variant="secondary"
            onPress={() => setAssumeOwner((v) => !v)}
          />
          <AppButton
            title="Guardar lecturas y ver reparto"
            loading={busy}
            onPress={() => {
              void run(preview);
            }}
          />
          <AppButton
            title="Guardar borrador para continuar después"
            variant="secondary"
            loading={busy}
            onPress={() => {
              void run(async () => {
                await repo.saveParticipants(id, parsedParticipants());
                refresh();
                Alert.alert('Borrador guardado', 'Puedes retomarlo desde Recibos.');
              });
            }}
          />
          <AppButton title="Atrás" variant="secondary" onPress={() => setStep(3)} />
        </>
      )}
      {step === 5 && distribution && (
        <>
          <Text style={styles.cardTitle}>Revisa la distribución</Text>
          <AppCard>
            <Text>Factura: {money(distribution.total_cents)}</Text>
            <Text>Medidores: {money(distribution.meter_cents)}</Text>
            <Text>Fijos: {money(distribution.fixed_cents)}</Text>
            <Text>Prorrateo: {money(distribution.shared_cents)}</Text>
            <Text>Deudas de inquilinos: {money(distribution.tenant_cents)}</Text>
            <Text>Gasto del propietario: {money(distribution.owner_cents)}</Text>
            <Text>
              Diferencia:
              {money(
                distribution.total_cents - distribution.tenant_cents - distribution.owner_cents,
              )}
            </Text>
          </AppCard>
          {distribution.allocations.map((a) => (
            <AppCard key={a.participant_id}>
              <Text>
                {a.unit_code} · {a.person_name} · {a.kind}
              </Text>
              <Text style={styles.amount}>{money(a.amount_cents)}</Text>
            </AppCard>
          ))}
          {distribution.warnings.map((w) => (
            <Text key={w}>{w}</Text>
          ))}
          <AppButton
            title="Finalizar recibo"
            loading={busy}
            onPress={() =>
              confirm(
                'Finalizar recibo',
                'Se guardará una copia permanente del cálculo y se generarán los cobros. Revisa que los importes y participantes sean correctos.',
                () =>
                  run(async () => {
                    await repo.finalizeReceipt(id, assumeOwner);
                    refresh();
                    setStep(6);
                  }),
              )
            }
          />
          <AppButton
            title="Corregir lecturas y participantes"
            variant="secondary"
            onPress={() => setStep(4)}
          />
        </>
      )}
      {step === 6 && record && (
        <>
          <Text style={styles.cardTitle}>
            {record.service_name} · {record.period}
          </Text>
          <Text style={styles.amount}>{money(record.total_cents)}</Text>
          <Text>
            {record.provider} · {record.receipt_number}
          </Text>
          <Text>Las condiciones y resultados confirmados se conservan en el historial.</Text>
          <AppButton
            title="Consultar distribución y consumos"
            variant="secondary"
            onPress={() => {
              void run(async () => {
                setDistribution(await repo.previewReceipt(id, true));
              });
            }}
          />
          {distribution?.allocations.map((a) => (
            <AppCard key={a.participant_id}>
              <Text>
                {a.unit_code} · {a.person_name}
              </Text>
              <Text>
                {money(a.amount_cents)} · Consumo {a.consumption / 1000}
              </Text>
            </AppCard>
          ))}
          <AppButton
            title="Compartir reparto en PDF"
            variant="secondary"
            onPress={() => {
              void run(async () => {
                const d = await repo.previewReceipt(id, true);
                await exportPdf(
                  'Distribución de factura',
                  d.allocations.map((a) => ({
                    Departamento: a.unit_code,
                    Responsable: a.person_name,
                    Modalidad: a.kind,
                    Importe: money(a.amount_cents),
                    Consumo: a.consumption / 1000,
                  })),
                  {
                    period: record.period,
                    property: (await repo.properties()).find((p) => p.id === record.property_id)
                      ?.name,
                  },
                );
              });
            }}
          />
          {attachments.data?.map((a) => (
            <AppButton
              key={a.id}
              title={`Compartir ${a.name}`}
              variant="secondary"
              onPress={() => {
                void run(() => shareAttachment(a, demo));
              }}
            />
          ))}
          {record.status === 'FINALIZADO' && (
            <>
              <AppInput label="Motivo de anulación" value={reason} onChangeText={setReason} />
              <AppButton
                title="Anular recibo"
                variant="danger"
                loading={busy}
                onPress={() =>
                  confirm(
                    'Anular recibo',
                    'El registro original se conservará. Primero deben revertirse los pagos asociados.',
                    () =>
                      run(async () => {
                        await repo.cancelReceipt(id, reason);
                        refresh();
                      }),
                  )
                }
              />
            </>
          )}
          <AppButton title="Volver a recibos" onPress={() => router.replace('/(tabs)/receipts')} />
        </>
      )}
    </Screen>
  );
}
