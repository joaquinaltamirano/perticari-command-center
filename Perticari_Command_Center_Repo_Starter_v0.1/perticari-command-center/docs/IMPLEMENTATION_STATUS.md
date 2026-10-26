# Auditoría y evolución V2

Estado inicial: aplicación V1 ejecutable en Workers/D1, React, esbuild, Node 24. Rama de trabajo `feat/v1-command-center`; cambios de V1 preexistentes sin commit, preservados. Se conserva OAuth, MFA, importaciones, precios, borradores y controles de ejecución.

## Hallazgos reproducibles

- Preguntas: search filtra UNANSWERED y solo hace upsert de lo devuelto. Una pregunta respondida o eliminada en ML desaparece del search pero queda pendiente localmente indefinidamente. No existe reconciliación de pendientes.
- El cron anterior cada 15 min procesa hasta 3 trabajos por ejecución; catálogo y ventas compiten con atención. Las notificaciones no despiertan procesamiento hasta el cron.
- Bootstrap ordena preguntas por fecha de lectura, no de creación, y no muestra cobertura/antigüedad del estado remoto.
- Las respuestas locales no se actualizan en otras pestañas mientras se edita: se necesita preservar edición y distinguir cambio remoto.
- No hay flujo operativo de pedidos: se conservan solo métricas sin PII.
- Falta repositorio editable de conocimiento validado, feedback estructurado, proveedor de IA, políticas de ejecución, oportunidades persistentes y experimentos.
- Precio fuente se debe denominar precio público MEMOSOFT, nunca costo de adquisición.

## Dependencias externas

El entorno devuelve 403 al dominio de documentación ML, al Worker real y al acceso invitado MEMOSOFT. No hay secretos productivos locales. No se puede afirmar una prueba real de integración; se preservan flags de escritura. SDK oficial antiguo accesible, no certifica User Products ni Product Ads 2026. Referencia oficial OpenAI SDK accesible para un proveedor opcional y desactivado por defecto.

## Entrega

Los detalles finales, comandos y resultados se registran en TESTING.md y ENTREGA_V2.md. La funcionalidad comercial sin contrato verificable permanece explícitamente pendiente y no se simula como disponible.
