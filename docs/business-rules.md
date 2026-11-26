# Reglas de negocio

## Participación histórica

Los intervalos de ocupación son inclusivos. El día de salida pertenece a la ocupación anterior; la siguiente comienza a partir del día siguiente. Los periodos mensuales consideran cualquier ocupación que interseque el mes. No hay reparto automático por días. Los asistentes muestran los cambios de mitad del periodo y exigen revisar el importe acordado y los participantes.

Los servicios se confirman por ocupación y con vigencia. La nueva configuración cierra la vigencia previa el día anterior. No se permite insertar condiciones antes de periodos ya confirmados ni sobre una vigencia futura existente. Si hay más de una condición dentro del mes, se selecciona la última como propuesta y se marca para revisión. Los habitantes del reparto pueden revisarse en el borrador.

Una unidad sin ocupación en el periodo no recibe cobros ni requiere lecturas. Finalizar una ocupación conserva sus deudas. La identidad de la deuda nunca cambia al siguiente inquilino. El propietario no genera alquiler; sus participaciones en facturas se registran como gastos propios, sin simular recaudación.

## Cálculo de facturas

Todos los importes entran y salen como céntimos enteros. Las lecturas se escalan por 1000. Se rechazan negativos, valores inseguros, lecturas incompletas y consumo individual superior al total.

```text
consumo individual = lectura actual − lectura anterior
importe por medidor = importe factura × consumo individual / consumo factura
saldo = importe factura − importes medidos − fijos vinculados
prorrateo equitativo = saldo / número de participantes
prorrateo por habitantes = saldo × habitantes / habitantes del grupo
factura = cobros de inquilinos + gastos del propietario
```

El grupo de medidores se redondea a céntimos una vez; sus céntimos se reparten por mayores residuos según consumo. El grupo de prorrateo aplica mayores residuos según su criterio congelado. Los empates se resuelven por el identificador estable del participante. El resultado no depende del orden de entrada. Productos y residuos usan BigInt. Los fijos acordados no se ajustan para ocultar errores.

Si el consumo total y los consumos individuales son cero, los medidores reciben cero y el resto sigue su distribución. Si el saldo es negativo se bloquea la finalización. Si queda saldo sin participantes de prorrateo, se exige confirmar expresamente que el propietario lo asume. La diferencia final debe ser exactamente cero.

Esta fórmula distribuye el importe completo de la factura proporcionalmente al consumo; **no es una tarifa oficial** por kWh o m³. Los cargos fijos independientes no reducen facturas y se generan aparte cada mes. El criterio de reparto es único por servicio/recibo.

Ejemplo automatizado: S/400 y 500 kWh. 101 consume 150 → S/120; 102 consume 100 → S/80; 201 fijo → S/50; 202 y 301 equitativos → S/75 cada uno; 302 vacío → cero.

## Cobros y pagos

La generación mensual es manual, revisable e idempotente. No depende de tareas en segundo plano. Los conceptos se identifican por ocupación, periodo y origen; repetir la generación no duplica cobros. Un alquiler de cero es permitido.

Los pagos deben ser positivos y coincidir exactamente con la suma de sus aplicaciones. No se admiten anticipos ni saldos a favor. La sugerencia aplica primero a la deuda más antigua de esa misma ocupación y permite cambiar los importes antes de confirmar. El pago y todas sus aplicaciones se guardan en una única transacción.

Estados: ANULADO si fue anulado; PAGADO cuando el saldo es cero; VENCIDO cuando queda saldo después del vencimiento; PARCIAL si hubo abonos y no venció; PENDIENTE en otro caso. Un vencido con abonos muestra también el importe pagado. Anular un pago exige motivo, conserva el original y restituye su saldo. Un recibo con pagos vigentes no puede anularse.

Los indicadores distinguen facturas de proveedores, obligaciones, saldo pendiente, dinero recibido por fecha de pago y gastos del propietario. El progreso de cobranza aplica a obligaciones del periodo; el dinero recibido del mes puede incluir pagos de deudas de meses anteriores.

La lectura y escritura decimal conserva todos los céntimos hasta el máximo entero seguro de JavaScript. Los agregados se calculan con BigInt y se rechazan si exceden ese rango; no se muestra un total redondeado silenciosamente.
