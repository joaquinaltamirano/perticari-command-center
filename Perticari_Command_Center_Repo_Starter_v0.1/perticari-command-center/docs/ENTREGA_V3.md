# Entrega V3 — expansión y mantenimiento

El espacio de preparación permite retirar borradores y administrar grupos de lotes conservando historial comercial. La auditoría detecta problemas de los datos de las publicaciones existentes y permite consultar contenido real antes de preparar reemplazos. Familias e imágenes se gestionan por correspondencia verificable.

Incluye lectura MEMOSOFT provisional hasta completar el catálogo, corrección de preguntas pendientes, historial de respuestas, plantillas persistentes, biblioteca/ZIP de imágenes, reemplazos con revisión, fuente BNA, zonas dibujables, búsqueda de direcciones/rutas, cotizaciones aceptadas, análisis de informes publicitarios, mantenimiento de precios por política y notificaciones cifradas.

La instalación está en [PROBAR_V3.md](PROBAR_V3.md). La matriz de límites está en [ESTADO_V3.md](ESTADO_V3.md). [Contratos consultados](V3_INTEGRACIONES_FUENTES.md).

La entrega conserva OAuth, D1, MFA, conocimiento, pedidos, importaciones y controles anteriores. Se añaden tablas con CREATE IF NOT EXISTS; no se realizan borrados de datos al instalar. Los registros técnicos pendientes no se convierten en éxito por completar una tarea interna.

## Validación

Se ejecutan pruebas de dominio, D1/API, seguridad, contratos simulados y navegador Chromium de escritorio/móvil. La evidencia final de resultados se registra en `VALIDACION_V3.md`. Los tests no prueban acceso a cuentas productivas ni equivalen a certificar contratos actuales no disponibles desde este entorno.

## Reversión

Volver al despliegue anterior revierte código; no modifica automáticamente datos ni acciones ya enviadas aML. Antes de un piloto masivo, guardar y comprobar el punto de restauración D1 en Cloudflare. Las operaciones inciertas se reconcilian antes de repetir; no se reintenta una creación sin confirmar su resultado.
