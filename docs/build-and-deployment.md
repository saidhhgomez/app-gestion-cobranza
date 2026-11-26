# Ejecución en Windows y dispositivos

Configuración verificada: Expo **58.0.26**, React Native **0.88.1**, React **19.3.0**. Node 22.13 o posterior compatible; se utilizó Node 22.15.0. No se requiere backend, cuenta de usuario, API key ni credencial para ejecutar la aplicación con Expo Go.

## Android físico desde Windows

1. Instala Expo Go compatible con SDK 58 en el teléfono. Si el cliente disponible no admite ese SDK, utiliza el development build descrito abajo.
2. Conecta computadora y teléfono a la misma red Wi-Fi, sin aislamiento entre clientes. Mantén Metro abierto durante las pruebas de desarrollo.
3. Abre PowerShell en el proyecto. Las dependencias ya están instaladas; ejecuta:

```powershell
cd C:\Users\Said\Desktop\app-gestion-cobranza
npm.cmd start -- --lan --port 8081
```

4. Escanea el QR desde Expo Go. Si otro Metro ya escucha en 8081, reutiliza ese proceso; no aceptes otro puerto por accidente. `Ctrl+C` termina el proceso desde su terminal.
5. Si Windows solicita acceso de red para Node, permite la red privada de confianza. Revisa VPN o aislamiento Wi-Fi si no conecta.
6. Si no puedes usar LAN, detén Metro y prueba `npx.cmd expo start --tunnel`. El túnel necesita Internet y puede solicitar instalar una herramienta auxiliar; no se instaló durante esta entrega.
7. El primer inicio crea SQLite y sus migraciones automáticamente, sin datos de negocio. Completa u omite el tutorial. Sigue [la guía manual](manual-testing-guide.md).

En una copia nueva del repositorio ejecuta primero `npm.cmd ci`; conserva `package-lock.json`. No reinstales ni actualices para cada ejecución. Usar `.cmd` evita el bloqueo de `npm.ps1` sin cambiar políticas de PowerShell.

Para un emulador Android ya instalado usa `npm.cmd run android`. El entorno de entrega no dispone de Android SDK/adb confirmado; ese comando no se validó en emulador.

## iPhone físico desde Windows

1. Instala Expo Go para iOS que admita SDK 58.
2. Usa la misma red y el mismo comando Metro de arriba.
3. Escanea el QR con Cámara del iPhone y abre el enlace con Expo Go. Permite acceso a la red local si iOS lo solicita.
4. Prueba la aplicación, concediendo cámara/fotos cuando quieras adjuntar evidencia. `npm.cmd run ios` abre un simulador y requiere macOS/Xcode.
5. Si la versión disponible de Expo Go no admite SDK 58, utiliza un development build del mismo SDK. No cambies módulos Expo o React Native por separado.

## Expo Go y compilación propia

| Capacidad                                                                     | Expo Go compatible                                                          | Development build                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| Tutorial, administración, SQLite, recibos, pagos y reportes                   | Módulos incluidos; requieren aceptación en teléfono                         | Incluidos                                         |
| Cámara/galería, documentos, PDF, compartir y respaldos                        | Incluidos; permisos y aplicaciones del dispositivo condicionan el resultado | Incluidos; validar permisos propios               |
| PIN local con SecureStore                                                     | Incluido; no cifra SQLite                                                   | Incluido                                          |
| Biometría Android                                                             | Depende del dispositivo y credencial protegida; verificar manualmente       | Verificar manualmente                             |
| Face ID y SecureStore con requireAuthentication en iOS                        | Limitados en Expo Go; usar build propio para esta función                   | Requiere permiso Face ID y dispositivo compatible |
| Icono/splash propios, textos de permisos, identificadores y app independiente | El contenedor es Expo Go                                                    | Requiere build propio                             |

No se agregó `expo-dev-client` porque no es necesario para Expo Go. Cuando decidas producir una compilación de desarrollo, estos son los pasos opcionales desde Windows:

```powershell
npx.cmd expo install expo-dev-client
npx.cmd eas-cli login
npx.cmd eas-cli build --profile development --platform android
npx.cmd eas-cli build --profile development --platform ios
npx.cmd expo start --dev-client --lan --port 8081
```

Instala el artefacto generado en el teléfono y abre su QR/enlace desde el cliente propio. EAS requiere cuenta Expo y, para iOS físico, firma/provisionamiento de Apple y registro del dispositivo cuando corresponda. No se han creado cuentas, firmado aplicaciones ni ejecutado builds remotos. `eas.json` contiene perfiles development/preview/production. Instalar `expo-dev-client` cambia dependencias y debe acompañarse de `expo install --check` y Expo Doctor.

Alternativas locales: `npx.cmd expo run:android` con Android SDK/JDK; `npx expo run:ios` en macOS con Xcode. Los directorios nativos generados están ignorados por Git.

## Exportación y configuración

```powershell
npx.cmd expo install --check
npx.cmd expo-doctor
npm.cmd run typecheck
npm.cmd test
npm.cmd run bundle
```

`bundle` exporta JavaScript/Hermes y assets Android/iOS en `dist/`; no produce APK/IPA ni ejecuta permisos o interfaces nativas. Las dos exportaciones fueron verificadas. Metro muestra advertencias de entorno de color y resolución alternativa de `@noble/hashes/crypto.js`; la compilación completa correctamente. Se mantienen versiones compatibles y no se fuerza una actualización para ocultar avisos.

`app.config.ts` toma nombre/slug/versión de `src/core/config/brand.json` y extiende `app.json`, que define esquema, identificadores provisionales `pe.miinmueble.app`, icono original, splash y permisos. Cambia los identificadores antes de publicar. No hay secretos ni publicación remota.

Referencias oficiales: [Expo Go](https://docs.expo.dev/get-started/start-developing/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/) y [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). La compatibilidad se comprueba también contra los tipos y bundledNativeModules.json instalados.
