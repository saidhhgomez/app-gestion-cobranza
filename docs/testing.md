# Verificación

Los resultados finales y comandos ejecutados se registran en `delivery-report.md`. No se considera una exportación de bundle equivalente a ejecutar la aplicación en un teléfono.

Cierre: **60 pruebas Jest aprobadas en 11 suites y 6 comprobaciones SQLite en disco**, cero fallidas. Cobertura de líneas del conjunto seleccionado: 95.09%; no mide toda la aplicación. Recorrido con datos y resultados esperados: [manual-testing-guide.md](manual-testing-guide.md).

## Automatización

- Jest/jest-expo: motor puro, aritmética entera, conservación y determinismo, modalidades, propietarios, exclusiones, lecturas y errores.
- SQLite WASM real (`sql.js`): ejecuta la migración y los métodos del mismo repositorio de producción, con adaptadores que sustituyen únicamente el puente Expo. Comprueba FK, solapamientos, unicidad, transacciones, pagos, reversos y snapshots.
- Pruebas de respaldo: SQLite WASM y archivos reales en `.test-output/`, reemplazando los puentes nativos de FileSystem/Crypto/SQLite. Verificación de referencias, corrupción, copia previa y fallo controlado de sustitución.
- React Native Testing Library: formularios y validación, botones, fechas accesibles, estados vacíos y confirmación explícita.
- Flujo integral: demo separada, S/400, propietario, pagos, cambios futuros, salida y restauración. Asistente de recibos con borrador recuperable y prueba de navegación preservada al bloquear/volver de segundo plano.
- Python sqlite3: seis comprobaciones adicionales en archivos SQLite reales, incluyendo WAL, cierre/reapertura, copia consistente e integridad referencial.

```sh
npm test
npm run coverage
npm run test:sqlite
npm run typecheck
npm run lint
npm run format:check
npx expo install --check
npx expo-doctor
npm run bundle
npm audit
```

## Aceptación manual en Android y iOS

1. En instalación nueva, verifica cuatro pantallas de bienvenida y persistencia al finalizar.
2. Crea inmueble, seis departamentos, personas y cinco ocupaciones; deja uno disponible. Para el ejemplo literal usa cinco inquilinos; en la variante propietario cambia el tipo desde el registro inicial o utiliza la demostración.
3. Configura dos medidores, un fijo y dos prorrateos; confirma que no hay participación automática de la unidad vacía.
4. Registra S/400 y 500 kWh, lecturas de 150 y 100 kWh y fijo de S/50. Comprueba S/120, S/80, S/50, S/75, S/75 y cero para el desocupado.
5. Adjunta foto de cámara, imagen de galería y PDF; vuelve atrás, retoma el borrador y comprueba los documentos.
6. Finaliza la factura, genera los alquileres y repite ambas operaciones: no debe duplicarse ningún importe.
7. Paga parcialmente una obligación, revisa saldo, paga el resto y comprueba PAGADO. Anula un pago con motivo y comprueba el saldo restituido.
8. Genera estado de cuenta y constancia PDF; revisa A4, nombres y totales. Abre compartir y cancela: la aplicación no debe afirmar un envío.
9. Cambia servicio, renta y habitantes desde un periodo futuro. La factura previa debe mantener su instantánea.
10. Finaliza la ocupación; verifica deuda conservada y ausencia de nuevos cobros posteriores. Reingresa otra persona y confirma servicios de nuevo.
11. Crea respaldo, modifica datos, restaura y revisa documentos y saldos. Cierra y reinicia la aplicación; los datos deben permanecer.
12. Activa PIN, prueba cinco errores, espera, desbloquea; verifica bloqueo por retorno desde segundo plano y biometría con fallback al PIN.
13. Entra y sale de demostración: tus datos reales deben permanecer intactos.

No se dispone de un teléfono/emulador conectado confirmado en este entorno. Los pasos que dependen de capacidades nativas deben quedar registrados por plataforma después de realizarlos. Las pruebas de JS no sustituyen cierre forzado del proceso durante cada fase del diario de restauración, evaluación de accesibilidad con lector de pantalla ni revisión visual de PDF nativo.
