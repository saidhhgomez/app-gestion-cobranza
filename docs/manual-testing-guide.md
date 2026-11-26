# Recorrido de pruebas desde el teléfono

Usa datos ficticios. Anota modelo, Android/iOS, versión del sistema, Expo Go/build y periodo elegido. Este recorrido verifica navegación, presentación y capacidades nativas que requieren tu teléfono. Registra resultado esperado, observado y, si falla, pasos y mensaje exacto.

## 1. Abrir y explorar

Inicia según [Windows y dispositivos](build-and-deployment.md). Esperado: cuatro pantallas de bienvenida, Atrás/Siguiente/Omitir y nombre opcional. Finaliza con «Explorar la aplicación»: Inicio no debe mostrar ingresos ni inmuebles inventados. Cierra y abre; el tutorial completado no debe repetirse. Puedes volver a abrirlo desde Configuración.

En Más → Configuración, activa «Explorar con datos de demostración». Esperado: distintivo de demostración, dos inmuebles ficticios y operaciones de ejemplo. Selecciona «Edificio Los Olivos · EJEMPLO» y el periodo de su factura. Su 301 es del propietario: factura S/400, obligaciones de servicio S/325 y gasto propio S/75. El gasto propio no es dinero recibido. Sal de demostración: la base real debe seguir vacía. La demostración no se reinicia al entrar de nuevo.

## 2. Crear tu escenario desde cero

En modo real crea «Edificio Prueba», dirección «Av. Ejemplo 123», distrito Los Olivos, Lima. Selecciónalo. Crea departamentos activos 101, 102, 201, 202, 301 y 302. Repetir código dentro del mismo inmueble debe dar un error comprensible; otro inmueble puede utilizar ese código.

Crea cinco personas con apellidos «Prueba» y documento opcional vacío. Registra estas ocupaciones desde el primer día del mes que probarás (por ejemplo, 01/11/2026 para 2026-11), sin salida, alquiler S/500 y vencimiento día 5. Utiliza INQUILINO para las cinco. Deja 302 sin ocupación.

| Departamento | Responsable     | Habitantes | Participación en Luz |
| ------------ | --------------- | ---------: | -------------------- |
| 101          | Lucía Prueba    |          1 | MEDIDOR              |
| 102          | Carlos Prueba   |          2 | MEDIDOR              |
| 201          | Ana Prueba      |          1 | FIJO S/50, vinculado |
| 202          | Luis Prueba     |          1 | PRORRATEO            |
| 301          | Rosa Prueba     |          3 | PRORRATEO            |
| 302          | Sin responsable |          — | Sin configuración    |

Esperado: cinco ocupaciones, una unidad disponible. Otra ocupación superpuesta debe bloquearse. No es obligatorio identificar a cada habitante: la cantidad para repartir se configura aparte.

## 3. Servicios y medidores

En Más → Servicios habilita «Luz», unidad kWh, admite medidor Sí, factura general Sí y criterio EQUITATIVO. Elige cada ocupación y configura su participación desde el primer día del mes. Para 201 marca el fijo como vinculado a la factura, sin opción independiente. Para otras modalidades deja fijo cero. No habilites nada en 302.

En Medidores instala uno de Luz en 101 y otro en 102, lectura inicial 1000. Esperado: un medidor activo por unidad/servicio; las lecturas se asocian al medidor y su historial.

## 4. Factura de S/400

En Recibos selecciona inmueble y periodo, crea recibo de Luz, proveedor «Proveedor de prueba», número «PRUEBA-001», importe 400.00 y consumo total 500 kWh. Usa emisión día 1 y vencimiento último día del mes. Recorre los seis pasos del asistente:

1. Completa datos y guarda el borrador. Volver a abrir debe recuperar la edición sin generar deuda.
2. Adjunta una imagen de galería y un PDF pequeño. Prueba cancelar selección y denegar permisos: debe conservar el formulario y comunicar errores sin cerrarse.
3. Comprueba que 302 no participa. En 101 registra anterior 1000 y actual 1150; en 102, anterior 1000 y actual 1100. Adjunta opcionalmente una foto al medidor. Una lectura inferior a la anterior o consumo individual superior al total debe bloquearse.
4. Revisa distribución y confirma expresamente su revisión antes de finalizar.

| Departamento | Cálculo esperado          |  Importe |
| ------------ | ------------------------- | -------: |
| 101          | 400 × 150 / 500           | S/120.00 |
| 102          | 400 × 100 / 500           |  S/80.00 |
| 201          | Fijo vinculado            |  S/50.00 |
| 202          | (400 − 120 − 80 − 50) / 2 |  S/75.00 |
| 301          | Mismo reparto             |  S/75.00 |
| 302          | Desocupado                |   S/0.00 |
| Total        | Diferencia cero           | S/400.00 |

Finaliza y vuelve a abrir: debe quedar FINALIZADO e inmutable. Reintentar no debe duplicar cobros. Otro recibo vigente de Luz del mismo mes debe rechazarse. Antes de pagar puedes anular con motivo y crear una corrección; conserva el original en historial. Con pagos vigentes, la anulación de factura debe bloquearse.

## 5. Habitantes, propietario y cargos independientes

Usa otro mes sin operaciones confirmadas para no modificar el ejemplo anterior. Cambia Luz a POR_HABITANTES para ese recibo. Mantén consumos y fijo; el saldo S/150 entre 202 (1 habitante) y 301 (3) debe quedar S/37.50 y S/112.50. La factura anterior debe seguir S/75 y S/75. Para las nuevas lecturas, parte de las finales del mes anterior y suma nuevamente 150 y 100.

Para propietario usa la demostración o crea otro escenario con 301 PROPIETARIO desde su registro inicial. Con reparto equitativo, su S/75 aparece en Gastos del propietario; los cobros de inquilinos suman S/325 y no hay alquiler del propietario. Configurar NO_APLICA en ese servicio lo excluye; no se asume participación automática.

Habilita Internet con cargo fijo independiente S/30 para 101 y vigencia desde el mes de prueba. Esperado: se propone en generación mensual, sin reducir ni intervenir en los S/400 de Luz. Si queda saldo sin participantes de prorrateo, el asistente exige confirmar que lo asume el propietario.

## 6. Alquileres y pagos

En Cobros → Generar cobros del mes revisa propuestas. En el escenario de cinco inquilinos, los alquileres son cinco × S/500 = S/2500. Con Internet independiente S/30, las obligaciones del mes son S/2930 (S/2500 + S/400 + S/30). Repite generación: no debe duplicar nada. Si una ocupación comienza a mitad del mes, revisa el importe manualmente; no hay descuento automático por días.

Abre el pago de la ocupación 101. Introduce S/50 y asigna manualmente todo al cobro de Luz de S/120; quita cualquier sugerencia a alquiler. Esperado: saldo de Luz S/70; si ya venció, VENCIDO con abono visible; si no, PARCIAL. Paga S/70 más a ese cobro: saldo cero/PAGADO. El alquiler queda pendiente. No debe admitirse un pago cuya distribución difiera del importe ni que exceda la deuda.

En Pagos recibidos genera constancia y adjunta evidencia. Anula el primer pago de S/50 con motivo «Prueba de reverso»: el original sigue visible como anulado y Luz vuelve a saldo S/50. El dinero recibido por fecha excluye pagos anulados y gastos propios. Guarda también un pago repartido en dos conceptos de la misma ocupación y comprueba ambos saldos.

## 7. Historia y cambios futuros

Antes de cambiar condiciones, crea un respaldo. Registra nueva renta/habitantes y configuración de servicio desde el primer día del mes siguiente. Esperado: la factura confirmada y sus nombres/importes conservan su instantánea. Un cambio retroactivo sobre un periodo confirmado debe impedirse.

Finaliza una ocupación al último día de un mes; su deuda permanece. En el mes siguiente no se propone alquiler nuevo para ella. Registra otra persona desde el día posterior a la salida: debe confirmar servicios de nuevo y empezar sin deudas heredadas. La deuda anterior sigue consultable con la persona anterior. Archivar un inmueble conserva historial y bloquea altas nuevas dependientes.

## 8. Reportes, archivos y uso sin conexión

Revisa los nueve tipos de Reportes, eligiendo inmueble, mes y persona cuando corresponda. Genera PDF de estado de cuenta y reparto; revisa caracteres españoles, títulos, contexto, paginación, totales y legibilidad A4. Los documentos son de control interno. Abre compartir, cancela y vuelve; no debe afirmar que envió nada. Prueba abrir/compartir fotos y PDF adjuntos.

Cambia inmueble/mes y comprueba los filtros. Pon el teléfono sin Internet después de cargar la app: registrar y consultar datos locales debe funcionar; compartir mediante otra aplicación depende de ella. En Expo Go una recarga completa del bundle requiere Metro; un build con bundle incorporado permite evaluar el arranque offline independiente.

## 9. Respaldo y restauración

En Copias de seguridad crea y guarda el JSON mediante compartir en una ubicación recuperable desde Archivos/Documentos. Debe incluir datos y evidencias de recibos/pagos. Modifica el nombre del inmueble. Selecciona y valida la copia: revisa origen y número de documentos; confirma restauración. Esperado: nombre anterior, saldos y evidencias restaurados. Cierra y abre y comprueba persistencia.

Cancela el selector y la confirmación: no debe cambiar nada. Un archivo inválido o de modo demo al restaurar en modo real debe rechazarse. No cierres la aplicación durante tu primera restauración. Interrumpir forzosamente cada fase del diario requiere un ensayo específico adicional; la automatización comprueba rollback ante fallo controlado.

## 10. PIN, cámara y accesibilidad

Activa un PIN de prueba de seis dígitos que recuerdes y el tiempo de bloqueo deseado. Prueba bloqueo, PIN incorrecto, cinco errores y espera indicada. Debe conservar datos. El PIN no cifra la base ni las copias.

Con un recibo sin terminar, abre cámara o selector y regresa. Debe conservar campos y paso; si transcurrió el tiempo de bloqueo, desbloquea y comprueba que el formulario sigue allí. Activa biometría con dispositivo compatible; para Face ID iOS usa development build. Prueba cancelación y alternativa PIN. Desactiva el PIN de prueba antes de olvidarlo: no existe recuperación remota.

Activa letra grande en Configuración y texto grande del sistema. Revisa desplazamiento, teclado, contraste, botones y TalkBack/VoiceOver. Registra pantalla y paso de cualquier problema para los ajustes posteriores.
