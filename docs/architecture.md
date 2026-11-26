# Arquitectura

Expo Router organiza cuatro pestañas: Inicio, Recibos, Cobros y Más. Los formularios y detalles se abren en stack. React Hook Form y Zod validan los formularios reutilizables. El recibo tiene guardado explícito de borrador y recuperación automática del estado de edición en preferencias SQLite, validada con Zod. Esto no convierte un borrador en deuda.

`Repository` es el contrato de persistencia (`src/core/contracts.ts`). Las pantallas utilizan este contrato mediante `AppProvider`; no contienen SQL. El repositorio implementa casos de uso con validaciones y transacciones. `finance.ts` es una función de dominio sin dependencias de React Native ni SQLite. El adaptador de archivos utiliza File/Directory/Paths de Expo FileSystem; los PDF utilizan Print/Sharing.

El contexto comparte la conexión, el inmueble, el periodo, el modo de demostración y una revisión que invalida consultas. No se utiliza Zustand: no hay necesidad de otro almacén global. Los datos de negocio siempre se leen de SQLite. `useQuery` maneja carga, fallos, reintento y cancelación de actualizaciones al desmontar. `ErrorBoundary` contiene errores de renderizado.

Las mutaciones pasan por una cola local. Cada transacción abre una conexión específica, activa y verifica `foreign_keys` **antes** de `BEGIN IMMEDIATE`, y realiza commit o rollback. Se evita `withExclusiveTransactionAsync` porque crea otra conexión y activar las FK dentro de su transacción no surte efecto. Los valores se enlazan mediante parámetros; la interpolación de SQL solo se usa para tablas/columnas de listas internas fijas.

La restauración comparte la cola de mutaciones. Prepara y valida todos los documentos antes de sustituir datos, conserva una base de rollback y un diario persistente. Al abrir la base, recupera cualquier restauración interrumpida antes de ejecutar migraciones o mostrar información.

Los importes y lecturas usan enteros. Los productos y cocientes financieros usan BigInt y mayores residuos deterministas. Las instantáneas incluyen identificadores, nombres, modalidades, habitantes, lecturas, resultados y versión del algoritmo. Los cambios posteriores de identidad o configuración no recalculan lo confirmado.

No se crean capas vacías por cada entidad. Los contratos y funciones puras permiten separar o sustituir el adaptador en futuras versiones. La plataforma objetivo es Android/iOS; la persistencia de este proyecto no ofrece una implementación web soportada.

La administración se implementa en `administration.ts`, el libro financiero en `repository.ts`, las consultas de reportes en `reports.ts` y la construcción de participantes en `helpers.ts`. `LockGate` oculta el contenido y su accesibilidad al salir de primer plano, conservando montada la navegación para no perder formularios al usar cámara o selectores. Este comportamiento tiene una prueba de regresión de ciclo de vida.

La identidad compartida vive en `src/core/config/brand.json`; `brand.ts` la expone a la aplicación y `app.config.ts` la lee directamente para que la configuración Expo funcione sin cargar imports TypeScript anidados. Tema y componentes viven en `src/core/theme/` y `src/shared/components/`.
