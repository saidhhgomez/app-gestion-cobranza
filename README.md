# Mi Inmueble

Aplicación móvil local para administrar inmuebles, ocupaciones, facturas de servicios, alquileres y pagos en Perú. Español, soles y fechas DD/MM/AAAA. No utiliza backend, login remoto, publicidad ni analítica.

## Ejecutar

Requiere Node **22.13 o posterior compatible**, npm y Expo Go compatible con **SDK 58**, o una compilación de desarrollo del mismo SDK.

```sh
cd C:\Users\Said\Desktop\app-gestion-cobranza
npm.cmd start -- --lan --port 8081
```

En Windows con ejecución de scripts restringida, usa `npm.cmd` y `npx.cmd`.

1. Instala Expo Go compatible en Android o iOS.
2. Conecta teléfono y computadora a la misma red.
3. Ejecuta `npm start` y escanea el QR (Cámara en iOS; Expo Go en Android).
4. Si la tienda aún no ofrece una versión compatible, utiliza una compilación de desarrollo. No cambies versiones aisladas de paquetes nativos.

```sh
npm run android
npm run ios
```

Android necesita emulador/SDK si se abre desde la computadora. El simulador iOS requiere macOS y Xcode. El funcionamiento diario es offline; la primera carga del bundle de desarrollo requiere conexión con Metro.

Las dependencias ya están instaladas y el lockfile está conservado. En una copia nueva del repositorio ejecuta `npm.cmd ci` antes de iniciar. Si Metro ya está activo en 8081, reutilízalo y evita iniciar otra instancia.

El recorrido con datos y resultados esperados está en [pruebas desde el teléfono](docs/manual-testing-guide.md).

## Stack

Expo 58.0.26, React Native 0.88.1, React 19.3.0, TypeScript estricto, Expo Router, SQLite, React Hook Form y Zod.

## Funciones

- Tutorial inicial, inmuebles, unidades, personas e historial de ocupación.
- Condiciones de alquiler y habitantes con vigencia; habitantes identificados opcionales.
- Servicios por ocupación: medidor, fijo vinculado, prorrateo o no aplica; fijos independientes.
- Asistente de recibos con borrador SQLite, fotografías/PDF, lecturas, reparto y confirmación transaccional.
- Cobros mensuales revisables y sin duplicación; pagos parciales, distribución manual y reversos auditables.
- Indicadores reales, consultas por inmueble y periodo, reportes A4 y menú nativo de compartir.
- PIN con derivación PBKDF2, biometría opcional y bloqueo por inactividad.
- Respaldo portable con SQLite y adjuntos, validación de integridad, copia previa y recuperación ante fallos.
- Demostración voluntaria en otra base de datos: Configuración → Explorar con datos de demostración.

## Verificaciones

```sh
npx expo install --check
npx expo-doctor
npm run typecheck
npm run lint
npm run format:check
npm test
npm run coverage
npm run test:sqlite
npm run bundle
npm audit
```

Python 3 es necesario únicamente para la comprobación adicional de SQLite en disco. Jest ejecuta el motor financiero, componentes y el repositorio contra SQLite WASM real; los puentes nativos se sustituyen por adaptadores de prueba. Esto no sustituye la aceptación en teléfono.

## Estructura

`app/` contiene las rutas Expo Router. `src/core/` contiene contratos, migraciones, repositorio, seguridad y almacenamiento; `src/features/` contiene el cálculo puro, recibos, reportes, respaldo y demostración; `src/shared/` contiene formularios, componentes y formato.

La identidad se configura en `src/core/config/brand.json`, `src/core/theme/tokens.ts` y `app.json`. El icono original y el splash se regeneran con `python scripts/generate-assets.py`.

## Consideraciones

SQLite y los respaldos **no están cifrados**. El PIN bloquea la aplicación. Conserva copias fuera del teléfono. Los PDF son documentos de control interno, no comprobantes SUNAT. Los adjuntos individuales admiten hasta 20 MB; el respaldo portable admite 80 MB. No hay anticipos ni saldos a favor. No se reparte alquiler por días automáticamente.

Face ID en iOS y la personalización completa de icono, splash y permisos requieren una compilación propia. Expo Go permite probar los módulos principales, sujeto a los permisos y capacidades de cada dispositivo.

Consulta [guía de uso](docs/user-guide.md), [arquitectura](docs/architecture.md), [base de datos](docs/database.md), [reglas](docs/business-rules.md), [pruebas](docs/testing.md), [seguridad](docs/backup-and-security.md), [builds](docs/build-and-deployment.md), [informe de entrega](docs/delivery-report.md) y [progreso](docs/implementation-progress.md).
