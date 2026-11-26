import { AppCard, Screen, styles } from '@/shared/components/ui';
import { Text } from 'react-native';
export default function Help() {
  return (
    <Screen title="Ayuda para tu gestión">
      {[
        [
          '¿Por dónde comienzo?',
          'Registra un inmueble, sus departamentos y las personas. Después registra cada ocupación y confirma sus servicios. Instala medidores si se utilizarán lecturas.',
        ],
        [
          '¿Qué es el prorrateo?',
          'Es repartir entre los departamentos participantes la parte del recibo que todavía falta cubrir. Puede ser en partes iguales o según su cantidad de habitantes.',
        ],
        [
          '¿Qué es un cobro fijo?',
          'Es un importe acordado que no depende de un medidor. Si pertenece a una factura, descuenta su saldo; si es independiente, se genera por separado cada mes.',
        ],
        [
          '¿Cómo se calcula por medidor?',
          'El consumo individual se divide entre el consumo total de la factura y se multiplica por su importe. Esta es una distribución proporcional del recibo completo; no es una tarifa eléctrica oficial por kWh.',
        ],
        [
          '¿Por qué no aparece un departamento?',
          'Las unidades desocupadas o sin servicio configurado no participan en el periodo. Las nuevas ocupaciones deben confirmar sus servicios; no se reactivan configuraciones antiguas.',
        ],
        [
          '¿Qué ocurre si alguien ingresa a mitad del mes?',
          'El importe no se divide automáticamente por días. Revisa el importe acordado en Cobros del mes y los participantes en cada factura.',
        ],
        [
          '¿Y si registré un pago incorrecto?',
          'Anula el pago desde Pagos recibidos e indica el motivo. El registro se conserva y se restablece el saldo de sus cobros.',
        ],
        [
          '¿Dónde se guarda mi información?',
          'En SQLite y archivos privados de este dispositivo. No hay cuenta remota ni sincronización. Crea copias de seguridad y guárdalas fuera del teléfono.',
        ],
        [
          '¿El PIN cifra mis datos?',
          'El PIN bloquea el acceso a la aplicación. SQLite y los respaldos no están cifrados por esta aplicación. Usa también el bloqueo y las protecciones de tu dispositivo.',
        ],
        [
          '¿La constancia es un comprobante SUNAT?',
          'No. Los PDF son documentos de control interno y no son comprobantes tributarios oficiales.',
        ],
      ].map(([title, text]) => (
        <AppCard key={title}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.subtitle}>{text}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
