# Informe de entrega inicial

Fecha de cierre: **25/11/2026**. Proyecto: `C:\Users\Said\Desktop\app-gestion-cobranza`.

## 1. Estado definitivo

Implementación inicial preparada para aceptación manual en Android/iPhone. Aplicación local, sin backend ni credenciales externas para Expo Go. SQLite se crea y migra automáticamente desde una base vacía; la demostración es voluntaria y usa otra base/directorio de adjuntos. Los errores de inicialización muestran mensaje y reintento. No se realizó push, commit, publicación ni firma de aplicaciones.

Esto no certifica ejecución nativa: no hay teléfono/emulador conectado ni Android SDK/adb o Xcode disponibles en el entorno. Los bundles se exportan correctamente para ambas plataformas.

## 2. Funcionalidades implementadas

- Tutorial de cuatro pantallas, omisión, nombre opcional y primer inmueble.
- Inicio con filtros, indicadores calculados, próximos vencimientos y recordatorio de respaldo.
- Inmuebles, departamentos activos/disponibles, personas, ocupaciones y habitantes identificados opcionales.
- Alquileres y habitantes con vigencia, salida con historial y nueva ocupación sin heredar deudas.
- Servicios por inmueble y ocupación, medidor/fijo/prorrateo/no aplica, cargos independientes y participación configurable del propietario.
- Medidores, lecturas históricas y fotos vinculadas; control de coherencia con periodos anteriores y posteriores.
- Asistente de recibos, borrador recuperable, adjuntos, participantes, vista previa, confirmación transaccional, anulación y PDF de reparto.
- Cálculo en céntimos, mayores residuos deterministas, equitativo/por habitantes, separación de gastos propios y obligaciones.
- Cobros mensuales revisables sin duplicación, pagos parciales/completos y aplicaciones múltiples de la misma ocupación, evidencias, constancias y reversos con motivo.
- Historial, estados derivados del saldo y nueve consultas/reportes A4 con compartir nativo.
- PIN local, limitación persistente de intentos, biometría opcional y ocultación de datos en segundo plano.
- Respaldo portable SQLite + evidencias, hashes, validación estructural/financiera, copia previa, sustitución coordinada y diario de recuperación.
- Demostración separada, configuración, letra grande y ayuda.

## 3. Pendientes de aceptación

No se deja un módulo esencial como pantalla de relleno o TODO. Queda ejecutar y registrar el recorrido físico de [pruebas manuales](manual-testing-guide.md): permisos, cámara/galería, documentos, PDF real, compartir, SecureStore/biometría, accesibilidad y persistencia tras cierre forzado. También falta ensayar interrupción forzada en cada fase nativa de restauración; se probó rollback automático ante fallo controlado con adaptadores.

La valoración visual y los ajustes específicos posteriores se realizarán sobre esta implementación, sin rehacerla.

## 4. Correcciones de esta continuación

- Se conserva la navegación montada al ocultar/bloquear, evitando perder formularios al regresar de cámara o documentos; prueba de regresión de AppState y desbloqueo.
- Validaciones impiden altas dependientes nuevas en inmuebles archivados y muestran errores de persistencia comprensibles.
- Formato, entrada y edición decimal exactos; sumas verificadas con BigInt para rechazar desbordamientos sin perder céntimos.
- Espera explícita de las operaciones asíncronas File/Directory de SDK 58; los marcadores breves del diario usan las variantes síncronas correspondientes.
- Adjuntos de pagos y fotos por medidor integrados; limpieza prudente de archivos huérfanos conocidos con antigüedad superior a 24 horas, con prueba sobre archivos reales.
- Contexto de inmueble/periodo en PDF y detalle de aplicaciones/saldo para constancias.
- Identidad compartida JSON: corrige el fallo de imports TypeScript anidados al evaluar `app.config.ts`.
- Documentación actualizada y recorrido reproducible de S/400. Se eliminaron instrucciones de progreso obsoletas de SDK 56.

## 5. Versiones y decisiones

Expo **58.0.26**, React Native **0.88.1**, React **19.3.0**, Expo Router **58.0.32**, TypeScript **6.0.3**, SQLite **58.0.18**, FileSystem **58.0.14**, RHF **7.92.0**, Zod **4.6.7**, Jest **30.5.2** / jest-expo **58.0.15**. Versiones completas resueltas en `package-lock.json`.

TypeScript estricto y contratos de repositorio; dominio financiero puro; SQLite con FK, WAL, restricciones y triggers de inmutabilidad. Cada escritura activa FK antes de BEGIN IMMEDIATE en su conexión dedicada. Snapshots preservan responsables, condiciones, lecturas y resultados confirmados. No hay servidor, sincronización ni dependencia de red para el negocio. Se usa contexto React para estado compartido reducido, RHF/Zod para formularios y módulos Expo para capacidades nativas.

## 6. Resultados reales

| Comando/comprobación                      | Resultado final                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm.cmd run typecheck`                   | Aprobado, cero errores                                                                            |
| `npm.cmd run lint`                        | Aprobado, cero errores/advertencias                                                               |
| `npm.cmd run coverage`                    | 11 suites aprobadas; 60 pruebas aprobadas, cero fallidas                                          |
| `npm.cmd run test:sqlite`                 | 6 pruebas adicionales aprobadas, cero fallidas                                                    |
| `npx.cmd expo install --check`            | Dependencias al día y compatibles                                                                 |
| `npx.cmd expo-doctor`                     | 20/20 comprobaciones aprobadas                                                                    |
| `npm.cmd ls --depth=0`                    | Árbol instalado válido                                                                            |
| Comparación package.json/raíz de lockfile | Dependencias y devDependencies coinciden                                                          |
| `npm.cmd run bundle`                      | Android e iOS exportados a dist, 52 assets y un bundle Hermes de unos 4.4 MB por plataforma       |
| `git diff --check`                        | Sin errores de espacios                                                                           |
| ZIP / Git bundle originales               | ZIP íntegro; historial completo verificado                                                        |
| Metro, puerto 8081                        | Iniciado; `/status` responde `packager-status:running`; manifiesto Android anuncia exposdk:58.0.0 |
| `npm.cmd audit`                           | 22 moderadas, cero altas/críticas; salida 1 por hallazgos                                         |

La cobertura seleccionada es **95.09% de líneas**, 93.04% de sentencias, 84.67% de ramas y 97.14% de funciones. Solo mide motor financiero, formato y validación portable según `jest.config.js`; no es cobertura de toda la aplicación. Jest ejecuta migraciones/repositorio en SQLite WASM real y archivos reales mediante adaptadores de puentes nativos. Python ejecuta SQLite en disco, WAL, FK, solapamientos, rollback, reapertura y copia consistente. El escenario integral comprueba demo aislada, S/400, propietario, pagos, cambios futuros, salida y restauración.

`npm.cmd run format:check` también aprobó: todos los archivos comprobados cumplen Prettier.

Las comprobaciones detectaron fallos intermedios de configuración Expo y del tipo Directory del adaptador de prueba; se corrigieron y los comandos correspondientes se repitieron hasta obtener los resultados anteriores. Un intento de Metro con `--lan --offline` fue rechazado por flags excluyentes y se sustituyó por `--lan`.

## 7. Dependencias y auditoría

Se conservaron versiones compatibles y el lockfile. No se ejecutó audit fix --force ni reinstalaciones durante el cierre. Los 22 hallazgos moderados son paquetes afectados directa o transitivamente por [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) y [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249), usados por herramientas de búsqueda/compilación de Expo fingerprint y Jest. Pueden causar consumo excesivo de recursos al procesar patrones/árboles no confiables en herramientas; no se usan como lógica de cobros ni de restauración en el teléfono. Que Expo sea dependencia de producción no convierte todas sus herramientas Node en código de la aplicación móvil.

El reporte local está en `.test-output/audit.json`. npm propone, entre otras soluciones, cambiar a Expo 52/Jest 29, incompatible con mantener este SDK. Alternativas: esperar versiones compatibles corregidas de las herramientas o evaluar overrides dirigidos en una rama y repetir Doctor, pruebas y bundles. No se declara la auditoría limpia. El cierre conserva la configuración comprobada y documenta la deuda de mantenimiento.

Las exportaciones emiten advertencias sobre NO_COLOR/FORCE_COLOR y la resolución alternativa de `@noble/hashes/crypto.js`; ambas plataformas completan. El PIN usa sal aleatoria de Expo Crypto y PBKDF2; sus pruebas verifican derivación, intentos y desbloqueo.

## 8. Inicio inmediato y teléfonos

```powershell
cd C:\Users\Said\Desktop\app-gestion-cobranza
npm.cmd start -- --lan --port 8081
```

Las dependencias ya están instaladas. Reutiliza Metro si sigue activo; no ejecutes otra instancia. En una copia nueva ejecuta antes `npm.cmd ci`. Computadora y teléfono en la misma Wi-Fi; Android escanea con Expo Go compatible con SDK 58, iPhone con Cámara → Expo Go. Instrucciones completas, solución de conexión y development builds en [build-and-deployment.md](build-and-deployment.md).

En esta sesión la Wi-Fi anuncia `exp://10.116.69.24:8081`. QR local: `.test-output/metro-qr.png`. La dirección y el QR dejan de servir si cambia la IP o se detiene Metro; inicia de nuevo para obtener el enlace actualizado.

Face ID/SecureStore con autenticación en iOS y la identidad nativa propia requieren development build. Los módulos principales están incluidos en Expo Go compatible; no se verificó la versión instalada en tu teléfono. Un build EAS opcional requiere cuentas/firma y no fue creado en esta entrega.

## 9. Documentación y respaldo Flutter

Documentos: README, arquitectura, modelo de datos, reglas, uso, pruebas, seguridad, builds, este informe, progreso y [guía manual](manual-testing-guide.md), todos en `docs/` salvo README.

Se retiró únicamente `gestor_inquilinos_app/`: 129 archivos de la plantilla Flutter, incluyendo Dart, pubspec/lock, test y proyectos Android/iOS/Linux/macOS/Windows/web. Inventario completo en `.migration-backup/flutter-files.txt`. Se conserva LICENSE y `.git`; no se hizo reset ni reescritura de historial.

Antes de retirarlo se generaron `.migration-backup/flutter-original.zip` (140 entradas ZIP, incluidos directorios, 129 archivos inventariados) y `.migration-backup/history.bundle` (historia Git completa). Integridad ZIP y Git verificadas. SHA-256 del ZIP:

```text
4B5A6C3654F97C8C429D92812056BBCEE56353E54BF35E6BDB037019C378AA6C
```

La carpeta está ignorada por Git y permanece local. Para recuperar, extrae el ZIP en otra carpeta; no lo mezcles con este proyecto. El bundle permite inspeccionar/clonar la historia original aparte.

## 10. Límites y recomendación de prueba

SQLite y los respaldos no están cifrados. El PIN protege la interfaz, sin recuperación remota. Las huellas detectan corrupción, no autenticidad. Adjuntos hasta 20 MB y copias hasta 80 MB; PDF generado es caché regenerable. No hay anticipos/saldos a favor ni prorrateo automático de alquiler por días. Los PDF no son comprobantes SUNAT. La plataforma web no está soportada.

Empieza por demostración, sigue el escenario ficticio de S/400 y prueba respaldar/restaurar antes de introducir información real. Para evaluación offline del arranque independiente usa un build con bundle incorporado: Expo Go requiere Metro para cargar/recargar JS. Quedan pendientes las verificaciones nativas detalladas en la guía; no se presenta el proyecto como publicado ni certificado para producción.
