# Backlog y roadmap por incrementos — v0.1

## Regla de planificación
La estimación inicial de dos semanas es razonable para un **prototipo con datos y un piloto de atención muy acotado**, no para habilitar todas las funciones de escritura y automatización a escala. Se avanzará solo después de demostrar los criterios de aceptación de cada gate.

## EPIC 0 — Descubrimiento y baseline (bloqueante para integración de producción)
| ID | Tarea | Entregable | Gate |
|---|---|---|---|
| B00 | Exportaciones ML y MEMOSOFT de muestra | Fixtures desidentificados y diccionario columnas | Datos que abren correctamente |
| B01 | Verificar unicidad y correspondencia SKU | Informe de conciliación con excepciones | Sin falsos matches |
| B02 | Definir unidades por familia y factores | Tabla de conversiones aprobada | Pruebas de kg→unidad y m→barra |
| B03 | Acordar autorización y titularidad app API | Responsable y permisos documentados | Autorización de Perticari |
| B04 | Definir costos de infraestructura y stack mínimo | ADR hosting/MFA/DB/worker | Soporta 24/7 y backups |
| B05 | Construir dataset inicial de métricas | Baseline de ventas/consultas/ads | Métricas con fechas y fuente |

## EPIC 1 — Núcleo seguro (P0)
1. Scaffold Next.js/TypeScript; lint/format/tests; branch protection; configuración env de ejemplo sin secretos.
2. Autenticación admin con MFA; guardias server-side; repositorio; migraciones DB.
3. Importador MEMOSOFT (dry run, validación, commit) y modelo Family/Product/SKU/Pack.
4. Pantallas catálogo, reconciliación, calidad del dato y dashboard de salud.
5. App ML + OAuth en ambiente de prueba; leer cuenta/items/SKU sin mutaciones.
6. Jobs durables + webhook + recuperación mediante polling + observabilidad.

**Gate EPIC 1:** importa sin duplicar; toda discrepancia se exhibe; puede leer datos ML con sesión segura; worker procesa eventos de forma idempotente; no existen endpoints de escritura de producción habilitados.

## EPIC 2 — Sales Copilot (P0)
1. Sincronizar preguntas preventa, deduplicar y ordenar por nueva/no respondida.
2. Conectar base técnica aprobada, FAQ y datos fiables del ítem.
3. Generar sugerencia única breve, editable y con advertencias/evidencias.
4. Validaciones comerciales/seguridad/longitud; envío explícito por API después de reconfirmar estado.
5. Push a dispositivos suscritos, email fallback, rate limit y métricas atención.

**Gate EPIC 2:** pruebas con preguntas reales anonim. + fixtures adversariales; no se envía nada sin acción humana; un mismo question_id no genera respuestas duplicadas; fallas quedan visibles; al menos un flujo de punta a punta probado con cuenta autorizada.

## EPIC 3 — Pricing seguro (P0 análisis, P1 escritura)
1. Importar costos y precios base, moneda/IVA con vigencia.
2. Reglas puras para unidad física, cambios, comisión oficial y margen.
3. Simulación y comparación por item, exportación de lotes e incertidumbre.
4. Política mínima de margen, topes por SKU/lote, firmas de reglas y expiración.
5. Solo entonces habilitar ejecución graduada: 1 SKU → 5 SKU → lote limitado, con reversibilidad planificada y auditoría.

**Gate escritura:** prueba matemática de unidades/costo/margen, cotización vigente, comparador con ML validado, topes y aprobación documentada.

## EPIC 4 — Catálogo/publicaciones masivos (P1)
1. CRUD interno para fichas/atributos, media externa y estado de completitud.
2. Sugerencias de agrupación compatibles con la categoría y modelo UP.
3. Generador de borradores, preview de diferencias y validador de requisitos por categoría.
4. Escribir solo operaciones verificadas como permitidas; reportar resultados parciales y errores por item.

## EPIC 5 — Shipping Brain (P1)
1. Tabla aprobada de tres acarreos y cotización USD/ARS.
2. Cobertura por localidades/radios/polígonos con excepciones; nunca inferir precio no confirmado.
3. Reglas para despacho 1–3 días, retiro/entrega zonal y derivación provincias.
4. Posterior: conectar Flex/ME1 solo después de elegibilidad y proveedor.

## EPIC 6 — Growth & Ads (P1/P2)
1. Importar histórico, agregar snapshots programados y KPIs.
2. Informes diarios/semanales y ranking de acciones por prioridad y calidad de datos.
3. Simulación de publicidad y recomendación de estructura/objetivo.
4. Actualizaciones por API solo donde recurso vigente y permisos confirmen soporte y con aprobación; en otros casos, solo recomendación.

## Secuencia orientativa de trabajo
| Etapa | Entrega al usuario | Dependencia |
|---|---|---|
| 0: Discovery | modelo de datos validado + muestras | Exportaciones y autorización |
| 1: Core | login, importador, catálogo, lectura ML | Disponibilidad APIs y servicios |
| 2: Atención | inbox, IA editable, envío aprobado | Preguntas reales y conocimiento aprobado |
| 3: Precio | cotizador y dry-run, luego escritura controlada | Margen, moneda y unidades confirmadas |
| 4: Escala | publicaciones/lotes, logística, Ads | Registros reales y pilotos exitosos |

## Política para Codex
- Una tarea/PR por cambio coherente. No implementar EPIC 3 escritura porque EPIC 1 funciona.
- Cada PR debe: cumplir SRS, añadir tests, capturas UI cuando aplique, documentación, migración reversible y reporte de riesgos.
- No hardcodear tasas/cargos/logística/umbrales ads; usar reglas versionadas.
- No asumir formatos Excel sin conocer las columnas; constructor de mapeo y fixtures.
- Probar primero en mock/staging y en modo solo lectura ante ML.
