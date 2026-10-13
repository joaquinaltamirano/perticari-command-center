# Sprint 00 — Preparación y dirección técnica

Fecha: 2026-10-13. Estado: propuesta para acordar el siguiente hito. Este documento no modifica las especificaciones originales ni aprueba mutaciones en MercadoLibre.

## Resultado esperado

Un repositorio accesible para el desarrollo, contradicciones relevantes resueltas o explicitadas, arquitectura inicial justificada, backlog de PR pequeñas y primer prompt de implementación con aceptación verificable.

La dirección inicial es un monolito modular Next.js/TypeScript con PostgreSQL, integración oficial de ML y tareas persistentes. Versiones, ORM, autenticación/MFA, cola, hosting y presupuesto se decidirán con evidencia actual. El MVP completo incluye atención aprobada por humano y pricing informativo; el primer incremento puede ser más pequeño.

## Observaciones preliminares que deberá cerrar la auditoría

| Referencias | Diferencia o dependencia | Resolución propuesta, pendiente de acuerdo |
| --- | --- | --- |
| SRS FR-021 / FR-025; backlog EPIC 2 | La respuesta fundamentada es P0 pero documentación/FAQ/historial aparecen juntos como P1. | Incluir fuentes aprobadas mínimas y procedencia en P0; reservar la gestión avanzada y aprendizaje de FAQ para P1. |
| SRS FR-024; PD-22 | Push y email son P0, mientras configuración por dispositivo aparece pospuesta. | Exigir prueba de las alertas del dispositivo objetivo antes del piloto de atención; ampliar compatibilidad después. |
| Prompt 08; T-033 | Falta de margen mínimo se describe como BLOCKED, pero el test permite simulación informativa. | Separar cálculo informativo posible de elegibilidad para ejecutar; si falta margen, nunca marcar apto para autopricing. Si falta conversión/FX indispensable, no calcular un precio ficticio. |
| PD-04; arquitectura sección 7 | El estado dice bloqueante para escrituras, pero la columna bloqueada dice OAuth de producción. | Precisar autorización de lectura/datos empresariales y autorización de mutación por separado antes de conectar la cuenta real. |
| PD-02; Prompt 02 | El Excel real figura como bloqueo del importador, aunque se permiten mapeos configurables y fixtures. | La muestra bloquea validar el mapeo real, no preparar parser, interfaz y pruebas sintéticas. |
| Backlog EPIC 0; Prompt 01 | Métricas, unidades y elección de proveedores aparecen cerca de tareas iniciales que pueden avanzar sin esos datos. | Ordenar dependencias por entrega: Core local, conciliación real, atención y precios; no tratar todo pendiente como bloqueo global. |

Estos son hallazgos documentales preliminares; no se verificaron todavía APIs de ML ni datos comerciales reales.

## Insumos mínimos

| Insumo | Para qué sirve | Si todavía no está |
| --- | --- | --- |
| Repo y acceso de Codex verificado | Revisar y entregar cambios sobre la base correcta. | Se puede auditar el paquete documental. |
| Exportación MEMOSOFT con encabezados y 10–20 productos representativos | Identificar estructura, unidades, moneda, costo y ambigüedades reales. | Parser y fixtures genéricos; mapeo comercial pendiente. |
| Exportación ML con productos que coincidan con la muestra MEMOSOFT | Verificar SKU/publicación/variación y correspondencias. | Adaptador simulado y conciliación sintética. |
| Presupuesto mensual orientativo o indicación «pendiente» | Proponer despliegue, servicios y costos con límites claros. | Comparar opciones; no contratar servicios ni fijar costos no verificados. |

Conservar encabezados y estructura de los Excel. Ocultar datos de compradores y campos ajenos al análisis. Si se sustituyen precios, hacerlo explícito: se podrá validar formato, pero no rentabilidad. Proporcionar archivos fuera del repo; solo incorporar muestras revisadas y autorizadas como fixtures.

Para el piloto de atención se sumarán 10–20 preguntas desidentificadas y fichas/FAQ aprobadas. Tarifas, Flex, publicidad y reglas finales de precios no bloquean la preparación del Core.

## Secuencia propuesta

1. **S00 — auditoría y decisiones:** cerrar alcance y dependencias; elegir stack compatible; redactar PRs y primer prompt. Sin código de aplicación.
2. **S01 — base ejecutable:** scaffold, comandos reproducibles, persistencia/migraciones iniciales, configuración, calidad automatizada y autenticación según el hito aprobado. Datos sintéticos.
3. **S02 — catálogo:** importación en preview, validación y confirmación idempotente; estado de calidad y fuentes.
4. **S03 — ML lectura:** OAuth y lectura autorizados, persistencia externa y reconciliación sin correcciones automáticas.
5. **S04 — atención:** preguntas, conocimiento validado, borrador IA editable, alertas y envío aprobado, incorporados en PRs separadas.

Una URL privada de prueba requiere además desplegar el incremento en un hosting elegido y configurar su acceso. Preparar o publicar el entorno de Codex no crea esa URL del producto. No se promete un MVP completo al terminar la auditoría.

## Primera tarea para Codex cuando el Product Owner dé luz verde

```text
Trabajá sobre Perticari Command Center. Leé AGENTS.md, README.md, los ocho
documentos de specs/ y docs/SPRINT_00.md. Esta tarea es de auditoría y planificación;
no implementes aplicación, no instales dependencias y no conectes la cuenta real de ML.

1. Confirmá qué archivos y rama estás revisando. Identificá inconsistencias con referencias.
2. Contrastá los hallazgos preliminares de SPRINT_00; distinguí requisitos confirmados,
   propuestas técnicas y decisiones pendientes. No repitas el relevamiento A–H.
3. Proponé tres incrementos pequeños del MVP y un alcance concreto para el primero.
4. Para cada bloqueo indicá exactamente qué tarea impide y qué puede hacerse con mocks.
5. Proponé stack y estructura mínimos para un desarrollador; verificá versiones y
   compatibilidad en documentación oficial. Si falta presupuesto, dejá el hosting abierto.
6. Enumerá capacidades/endpoints ML que requieren verificación oficial antes de su
   implementación. Si no lográs verificar algo, marcá PENDIENTE; no inventes soporte.
7. Prepará las primeras PR y un prompt acotado para el scaffold, con criterios de aceptación,
   comandos de validación esperados y aislamiento de producción.

Entregá el informe en la respuesta sin modificar archivos. No solicites credenciales.
El siguiente hito se acordará con el Product Owner usando ese resultado.
```

## Aceptación del sprint de preparación

- Se comprueba acceso al repositorio y lectura de los documentos.
- Se identifica qué resolver ahora y qué puede posponerse por módulo.
- Hay una recomendación técnica concreta con alternativas solo donde falta evidencia.
- Cada tarea del primer incremento tiene resultado observable y validación.
- Se entrega un prompt de implementación pequeño y se declara qué falta para una demo privada.

La creación de este paquete valida la preparación de archivos; acceso a GitHub, configuración de Codex y despliegue deben comprobarse en sus respectivos entornos.
