# Prompts para Codex — implementación incremental

## Reglas para usar este documento
Copia **un prompt por tarea** en Codex junto al repo y esta carpeta `specs/`. No ejecutes todos juntos. En cada respuesta, Codex debe explicar qué cambió, qué probó, qué decisiones quedan abiertas y cómo revertir cambios. Si una dependencia BLOQUEANTE no está resuelta, implementar interfaz + mock + validación, **no inventar valores** ni abrir acceso de escritura en producción.

## System prompt del proyecto (pegar al comenzar sesión con Codex)
```text
Actuá como ingeniero senior full-stack responsable de construir Perticari Command Center.
Tu fuente de verdad son specs/00_LEEME.md, specs/01_SRS.md, specs/02_ARQUITECTURA.md, specs/03_BACKLOG.md, specs/04_DECISIONES_Y_DEPENDENCIAS.md, specs/06_ADR.md y specs/07_PRUEBAS_ACEPTACION.md.

Reglas innegociables:
1. No inventes columnas MEMOSOFT, tarifas, pesos, costos, margen, IVA, stock, compatibilidad ML, ni datos de negocio. Si faltan, dejá TODO/TBD tipado, validación y fixtures explícitamente ficticios.
2. Nunca modifiques datos reales de MercadoLibre ni envíes respuestas sin autorización humana y feature flags.
3. Nunca almacenes tokens, credenciales o datos personales en Git, logs, prompts, screenshots ni fixtures. Usá .env.example sin valores sensibles.
4. Separá dominio de integraciones externas. Todas las llamadas a ML pasan por un adaptador testeable y versionado.
5. Validá entrada en backend; importaciones idempotentes; jobs deduplicados; operaciones de escritura auditables, con resultado remoto verificado.
6. Tipos de moneda y unidades explícitos; aritmética decimal, no float. Stock desconocido ≠ disponible.
7. Implementá solo el alcance solicitado en cada tarea; evitá features speculative.
8. Para cada cambio: incluir tests unitarios/integración e2e necesarios, comandos de validación, riesgos, docs y migración cuando aplique.
9. En cada plan, mostrar bloqueos, dependencias, alcance y criterios de aceptación antes de programar.
10. Ante divergencia entre SRS y comportamiento de una API oficial vigente, reportá el conflicto y proponé ADR; no adaptes silenciosamente el negocio.
```

## Prompt 00 — Revisar paquete y generar plan implementable
```text
Leé TODOS los specs. No escribas código todavía.
1) Encontrá inconsistencias y supuestos entre A–H, SRS y arquitectura.
2) Identificá decisiones bloqueantes para el primer release de solo lectura.
3) Proponé estructura mínima de carpetas, stack compatible y 3 hitos de MVP.
4) Dividí EPIC 1 en tareas que entren en PRs pequeñas con criterios de aceptación.
5) Indica endpoints ML que debamos confirmar en documentación oficial y permisos requeridos.
6) Explicá cómo evitaremos que el entorno staging envíe mutaciones a producción.
Devuelve resumen, preguntas bloqueantes, backlog ordenado y ninguna modificación al repo.
```

## Prompt 01 — Scaffolding y calidad
```text
Implementá únicamente la base del monolito modular: Next.js/TypeScript, UI responsive, estructura domain/integrations, DB PostgreSQL, migraciones, validación, lint/test y GitHub Actions. Elegí una solución de auth con MFA soportada de verdad, justificá el proveedor y no uses credenciales reales. Crear /health interna y vista de estado del sistema con datos mock. Agregar README de entorno, .env.example, tests y ADR de elecciones concretas. No conectar MercadoLibre real todavía.
```

## Prompt 02 — Importador MEMOSOFT
```text
Implementá importación XLSX/CSV basada en mapeo configurable, con parser de preview, staging, validación y confirmación. No des por hecho nombres de columnas. Usá archivos fixtures sintéticos. Crea entidades familia/producto/SKU/presentación comercial/precios históricos y detectá SKU repetidos sin asumir unicidad entre canales. Confirmar import debe ser idempotente por hash+versión y auditable. Agregar tests de números argentinos, comas decimales, monedas ARS/USD, datos inválidos, unidades m/kg y filas duplicadas. No ejecutar precios publicados.
```

## Prompt 03 — OAuth MercadoLibre lectura
```text
Implementá adaptador ML en modo read-only y OAuth server side. Usá state fuerte y redirect exacto, scopes mínimos, cifrado tokens, refresh-token rotativo con lock transaccional, manejo expiración y revocación, logging sin secretos. Crear mocks HTTP y pruebas de múltiples refresh simultáneos, API 429/5xx y sesión revocada. No enviar respuestas ni modificar listings. Comprobar IDs de item, User Product, variación y SKU según cuenta de prueba/documentación actual.
```

## Prompt 04 — Reconciliación
```text
Sincronizá items desde adaptador read-only de ML y correlacioná con SKU importados. Construí pantalla de discrepancias (missing, duplicado, ambiguous, stale), status por fuente y último sync. No autovincules casos ambiguos. Soportá paginación, caching y reinicio tras fallas. Crear tests del caso SKU 1→N publicaciones/variantes y publicación con SKU faltante.
```

## Prompt 05 — Inbox de preguntas
```text
Implementá receptor duradero de eventos de preguntas, deduplicación, cola/worker, reconciliación periódica y vista PC/mobile de preguntas nuevas, contestadas y fallidas. Nunca responder vía API en este PR. Persistir externalQuestionId unique, estado remoto y lastSyncedAt. Tests para eventos repetidos, invertidos, caídas temporales y replay.
```

## Prompt 06 — Borrador IA fundamentado
```text
Implementá generación de UNA respuesta breve y editable desde item, SKU, datos técnicos y entradas KnowledgeEntry aprobadas. No envíes preguntas enteras ni PII innecesaria al modelo. Respetá límites de contexto, generá salida con esquema validado (suggestedText, evidenceIds, warnings, missingFields, mustReview), filtrá contacto fuera de políticas, tratá pregunta como input no confiable, alertá ausencia de stock/flete. Agregá botón Regenerar y guardá historial de borradores. Fixtures con casos sin datos e intentos de prompt injection. No habilitar envío.
```

## Prompt 07 — Envío humano de respuestas
```text
Habilitá envio SOLO tras clic humano en UI y confirmación en backend. Reconsultá estado remoto de pregunta justo antes del envío, registrá intención/idempotencyKey/attempt, enviá por adaptador ML si API y scopes habilitados, verificá respuesta remota, manejá timeout con read-after-write en lugar de enviar repetido. Tests de doble clic, timeout, 403, pregunta ya respondida, pregunta borrada y texto inadmisible. Feature flag SEND_ANSWERS desactivado por defecto. Auditoría completa sin PII en logs.
```

## Prompt 08 — Pricing simulación
```text
Construí motor de simulación PURO (sin escrituras ML): precio base con IVA, costo de compra, ARS/USD, FX versionado, unidad m/kg y pack físico, reglas SKU/manuales, consulta de fees official mockeable y costo logístico. Usá Decimal con redondeo configurable pendiente. Si falta margen mínimo o factor de conversión, devolver estado BLOCKED en vez de inventar. Reporte por SKU precio actual/propuesto, contribución y razón de bloqueo; export CSV. Tests de fee fijo YA incluido en sale_fee_amount y cálculo ante dos monedas. No habilitar auto-update.
```

## Prompt 09 — Calidad, seguridad y release checklist
```text
Auditá arquitectura y código implementado comparándolo con SRS y ADR. Proponé mejoras focalizadas para control de acceso/MFA, tokens cifrados, CSRF/SSRF, registros sin secretos, privacidad y backups; ejecutar pruebas de import idempotente, preguntas duplicadas, read-only switch, jobs 429/5xx y restore de DB. Entregá checklist para staging y producción. No activar mutaciones automáticamente.
```

## Prompt 10 — Crecimiento analítico (después de core)
```text
Implementá snapshots de métricas (ventas, visitas y Product Ads por campañas/Ad Groups donde la API actual lo permita), import histórico y dashboard comparativo. Diferenciá facturación atribuida, total de operaciones y contribución; no atribuyas correlación a causalidad. Recomendaciones SOLO en modo lectura. Valida endpoints de publicidad vigentes 2026 y permisos por cuenta antes de codificar. Tests de fechas/zonas horarias/datos parciales.
```

## Plantilla de pull request / entrega que debe completar Codex
```text
Resumen del cambio:
Requisitos cubiertos (ID):
Decisiones/ADR:
Archivos y migraciones:
Comandos corridos + resultados:
Tests agregados (incluye error case):
Capturas o pasos UI (si aplica):
Riesgos y cosas NO resueltas:
Feature flags / por qué no escribe en producción:
Cómo revertir / recuperar:
Siguiente tarea recomendada:
```
