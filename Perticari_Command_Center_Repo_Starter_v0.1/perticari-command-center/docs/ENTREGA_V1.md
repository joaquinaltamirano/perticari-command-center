# Entrega V1 · 2026-10-16

## Problema y resultado

El repositorio solo contenía especificaciones y la conexión OAuth vivía en un helper externo. Se incorpora una aplicación privada ejecutable para trabajar sobre catálogo, expansión, propuestas, precios, atención, entregas y resultados en el mismo Worker existente. La prueba comercial real y el despliegue son el siguiente paso guiado.

## Alcance cubierto

FR001/002: importación XLSX/JSON, selección de columnas, staging, preview, errores, confirmación e idempotencia. Conserva códigos exactos y varias publicaciones por SKU. Paquete inicial privado de1256códigos,200publicaciones y820precios originales; no incorporado a Git ni al bundle.

FR003/004/005/006: conserva OAuth y receptor previo, adaptador de lectura, jobs durables, polling, auditoría y fuentes. Lectura real desde esta versión pendiente de smoke test. MEMOSOFT invitado tiene fallback a Excel porque el formulario actual no pudo verificarse.

FR010/011: tablero con recomendaciones derivadas de datos, fechas de fuentes y estados pendientes; filtros, lotes de30, plantillas editables, control de versión y recordatorios de medios.

FR020/021/023: inbox y sugerencias deterministas con evidencia, borradores y aprobación. No se afirma integración con un LLM. El proveedor IA y grounding semántico están pendientes.

FR040/047: simulación con centavos enteros/BigInt,15% y tabla de cargo fijo editable, expiración de revisiones y tipo de cambio; CSV de propuestas. No calcula margen neto ni autopricing.

FR050/051/052/055: tarifas USD20/39,50/79, salida San Antonio1250, límites propuestos editables y cotizador manual; cobertura y FX condicionan confirmación; modalidades gratuitas y agencia. No hay routing/geocodificación automático.

FR060/071: resumen de operaciones pagadas, unidades y ventas brutas sobre datos disponibles, historial de intervenciones y auditoría. Visitas/Ads/conversión no implementados sin contratos y datos verificados.

FR073 y acceso: fixtures sintéticos, red externa bloqueada en tests, autenticación de contraseña + TOTP para endpoints privados, CSRF, cifrado y CSP probada en navegador.

## Archivos y migraciones

- src/domain: catálogo, importación, dinero y logística.
- src/server: OAuth, notificaciones, identidad/MFA, D1, API, jobs, integraciones y operaciones.
- src/client: panel React adaptable, recursos locales, sin datos comerciales embebidos.
- migrations/0001_notifications.sql y0002_command_center.sql: aditivas e idempotentes. OAuth conserva su esquema previo y se inicializa con el helper ya probado.
- scripts/build.mjs: bundle único para Cloudflare; prepare-data.py: conversión privada de archivos aportados.
- test/: dominio, app, OAuth, receptor, ML simulado y Chromium.
- root package.json, README y CI: comandos desde la raíz sin mover el paquete documental original.

## Validación ejecutada

- npm run build: compila interfaz y Worker sin datos comerciales.
- npm test:64pruebas de dominio/integración. Incluye MFA/replay, CSRF, importación idempotente y1256filas sintéticas, SKU1:N, vacío≠cero, rangos monetarios, bandas de precio final, chapa6m≠barra, cotización/zonas, OAuth/refresh concurrente, webhook/reinicio, lectura429 y ownership, rechazo de pregunta cerrada y escritura incierta sin reintento.
- test/browser.cjs: Chromium1440×1080 y390×844. Login real en HTTPS local, TOTP, import preview/confirm, filtros, preparación30borradores, plantilla de familia, edición de precio, cotización, fuentes, inbox, resultados y navegación móvil. Dos datasets:70productos/2publicaciones sintéticos y1256/200 del paquete privado. Sin errores de JavaScript ni llamadas a ML real.
- wrangler deploy --dry-run: bundle de aproximadamente490KiB, binding NOTIFICATIONS_DB detectado; no publica.
- npm audit --omit=dev: sin vulnerabilidades reportadas en dependencias de ejecución al consultar durante esta tarea.
- git diff --check: sin errores. Sin tokens reales ni archivos comerciales en las fuentes versionables.

Las pruebas con mocks validan nuestra lógica; no certifican endpoints/payloads vigentes para la cuenta real. Fuentes y pendientes se detallan en FUENTES_Y_LIMITES.md.

## Límites y siguiente paso

No hubo escrituras reales ni despliegue. Ambas flags de ejecución están deshabilitadas por defecto y la validación de contrato2026 es requisito previo del piloto; no una opción para omitirlo. Escrituras de precios legacy rechazan variantes/User Products. Un resultado incierto requiere reconciliación manual.

Completar: despliegue, smoke de lectura, contrato actual de creación/User Products y respuestas, acceso invitado MEMOSOFT, cargos vigentes, cobertura/FX e imágenes. Alertas push/email, backup externo automatizado/restore periódico, IA semántica y publicidad requieren el siguiente incremento y sus fuentes/configuración. La primera prueba ya permite trabajo real de preparación y revisión sin habilitar esas dependencias.

Reversión: conservar el deployment anterior de Cloudflare y volver a él; las tablas nuevas no eliminan credenciales ni notificaciones anteriores. Conservar exportación privada de D1 antes de pruebas. Nunca subirla al historial Git.
