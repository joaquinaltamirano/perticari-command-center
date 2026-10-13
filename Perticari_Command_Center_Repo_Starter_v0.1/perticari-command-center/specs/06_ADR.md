# ADR — Registro de decisiones de arquitectura v0.1

### ADR-001 — PWA web responsive
**Estado:** propuesta técnica; producto confirmó PC+móvil y no tiene preferencia de plataforma.  
**Decisión:** Next.js/TypeScript con soporte PWA y diseño mobile-first para inbox/alertas; escritorio para herramientas masivas.  
**Motivo:** código único, acceso remoto, escalabilidad y mantenimiento por una persona.  
**Límite:** push depende de permisos y restricciones del navegador/SO.

### ADR-002 — Monolito modular con worker
**Estado:** propuesta.  
**Decisión:** un repo, módulos desacoplados, API interna, worker persistente, cola durable, DB PostgreSQL.  
**Motivo:** complejidad contenida y procesamiento de eventos confiable.  
**Alternativa descartada ahora:** microservicios y colas distribuidas complejas.

### ADR-003 — Fuentes de verdad separadas
**Estado:** requisito derivado.  
**Decisión:** MEMOSOFT autoridad del precio/costo interno y atributos respaldados; ML autoridad del estado publicado, preguntas y ventas; PCC autoridad de las reglas, borradores y aprobaciones.  
**Límite:** solo tratar stock como autoridad tras validar calidad.

### ADR-004 — IA asistida, no autónoma en preguntas
**Estado:** confirmado.  
**Decisión:** única respuesta propuesta, breve, editable, advertencias; humano envía desde PCC.  
**Motivo:** precisión y responsabilidad comercial.  
**Límite:** prohibido envío autónomo y aprendizaje sin aprobación de FAQ.

### ADR-005 — Cambios externos gobernados
**Estado:** confirmado para reglas de catálogo/precios; detalle de topes pendiente.  
**Decisión:** aprobación/autorregla versionada, dry-run, audit log, verificación de respuesta ML, rollback operativo manual planificado.  
**Motivo:** protección frente a actualización masiva errónea.

### ADR-006 — Pricing decimal, unidades explícitas y fees oficiales
**Estado:** requisito técnico.  
**Decisión:** usar decimal, ARS/USD, IVA separado, presentación física por SKU y API `listing_prices`; nunca hardcodear % o umbral fijo de cargo ML.  
**Bloqueo:** margen mínimo, FX y unidad aún no aprobados.

### ADR-007 — Capas de integración por canal
**Estado:** propuesta.  
**Decisión:** interfaces/adaptadores, IDs externos mapeados, capacidades detectadas (legacy/UP, permisos).  
**Motivo:** ML primero con extensibilidad futura; sin código específico de ML infiltrado en dominio.

### ADR-008 — Infraestructura personal con custodia empresarial
**Estado:** titularidad personal **confirmada como preferencia**, esquema jurídico/operativo no aprobado.  
**Decisión propuesta:** recursos privados dedicados y segregados, autorización comercial escrita, plan de transferencia/exportación/revocación.  
**Riesgo:** acceso no autorizado o pérdida de continuidad.

### ADR-009 — Desarrollo seguro por gates
**Estado:** propuesta.  
**Decisión:** modo read-only y fixtures primero, staging después, escrituras por feature flag, pilotos y métricas.  
**Motivo:** construcción asistida por Codex sin poner la cuenta en riesgo.
