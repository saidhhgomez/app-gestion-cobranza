# Copias y seguridad

El bloqueo es opcional y local. El PIN de 6–12 dígitos se deriva con PBKDF2-HMAC-SHA256, 210000 iteraciones y sal aleatoria de 32 bytes. El resultado, la sal y la limitación persistente de intentos se guardan en SecureStore. Cinco intentos fallidos activan esperas progresivas de hasta quince minutos. La comparación recorre los bytes de la derivación. La biometría habilita una credencial protegida por autenticación del sistema y ofrece PIN como alternativa.

El ciclo de vida oculta la pantalla al salir y exige desbloquear según el tiempo seleccionado. Face ID y SecureStore con autenticación deben verificarse en compilación de desarrollo propia en iOS; Expo Go tiene limitaciones para esta función. El PIN no cifra SQLite, ni reemplaza el bloqueo del dispositivo. No existe recuperación remota del PIN. No se exportan secretos en los respaldos.

## Formato portable

JSON versionado: formato, versión, versión del esquema, versión de aplicación, fecha, modo real/demo, SQLite serializada y archivos referenciados. Cada recurso tiene tamaño y SHA-256; el manifiesto tiene una huella global. Se incluyen todos los datos SQLite y las fotografías/PDF privados, manteniendo sus nombres relativos UUID. El límite de archivo portable es 80 MB. Base64 aumenta su tamaño.

La serialización SQLite genera una imagen consistente de las páginas actuales, incluso con WAL; no se copia el archivo abierto directamente. Para deserializar en memoria se normalizan los indicadores WAL de la cabecera de la copia, porque SQLite no abre WAL en una imagen deserializada. Las escrituras, respaldos y restauraciones comparten una cola de exclusión local.

Las copias se conservan en el directorio privado `backups/`, además de poder compartirse. Una copia solo dentro del teléfono no protege de pérdida, desinstalación o daño del dispositivo. La aplicación muestra un aviso semanal en Inicio. El último respaldo se registra después de completarse.

## Restauración

1. Comprueba tamaño, formato, versión, base64, hashes y rutas UUID permitidas; rechaza archivos extra o faltantes.
2. Abre la candidata en memoria con esquema no confiable y modo consulta; exige coincidencia exacta de tablas, índices, vistas y triggers con la aplicación. Verifica integridad, FK y saldos/asignaciones.
3. Exige que la copia pertenezca al modo activo; los datos de demostración no sustituyen los reales.
4. Antes de tocar datos activos, crea otra copia portable y una base `rollback.db`, prepara los documentos en un directorio temporal y escribe un diario persistente.
5. Conserva documentos anteriores, mueve los nuevos y utiliza la API nativa de backup SQLite para sustituir la base. Verifica otra vez la integridad y escribe el marcador de finalización.
6. Si falla, restaura la base y documentos anteriores. Al abrir de nuevo, resuelve cualquier diario interrumpido antes de mostrar pantallas. Una operación ya confirmada solo completa su limpieza.

Los adjuntos se importan con nombres únicos. Si registrar sus metadatos falla, se retira el archivo copiado. Si un fallo ocurre después de eliminar metadatos y antes de borrar físicamente el archivo, puede quedar un archivo sin referencia; los respaldos incluyen exclusivamente referencias válidas. Al iniciar se eliminan únicamente archivos con nombre UUID y extensión admitida que no tengan referencia y cuya última modificación supere 24 horas. Se conservan archivos recientes o desconocidos.

Las huellas detectan corrupción accidental, **no prueban autenticidad**: una persona puede modificar datos y recalcular hashes. Las copias y SQLite no tienen cifrado autenticado. Solo deben restaurarse respaldos de confianza. El sistema operativo puede generar sus propios respaldos del contenedor según su configuración; proteger el dispositivo sigue siendo necesario.

Las evidencias PDF importadas se respaldan junto con fotos y comprobantes de pagos. Los PDF generados para reportes y constancias son archivos temporales de caché: se pueden volver a generar desde los datos y no se incluyen como documentos adjuntos. El PIN y la biometría son locales al dispositivo y quedan fuera de la restauración.
