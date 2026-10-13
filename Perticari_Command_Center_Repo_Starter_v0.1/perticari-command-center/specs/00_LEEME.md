# Perticari Command Center — paquete de ingeniería v0.1

**Fecha:** 2026-10-13  
**Estado:** requisitos A–H relevados; especificación *baseline*, no diseño final validado.  
**Uso:** guía para Product Owner, desarrollo asistido con Codex y validación sobre datos reales.  
**Canal inicial:** MercadoLibre Argentina. Usuario inicial: un administrador.

## Objetivo
Crear un centro operativo privado para Perticari & CIA S.A. que permita trabajar sobre MercadoLibre desde una interfaz propia: responder preguntas preventa con borradores de IA aprobados por humano, administrar productos/publicaciones, simular y actualizar precios dentro de reglas, evaluar logística, analizar publicidad y registrar decisiones comerciales.

## Principio rector
**Leer → reconciliar → proponer → simular → aprobar o cumplir regla autorizada → ejecutar → verificar resultado → auditar.**
Nunca inferir éxito por recibir un HTTP 200 si la operación requiere verificación posterior. No prometer stock, transporte, rentabilidad ni cobertura cuando el dato no está validado.

## Documentos
- `01_SRS.md`: especificación funcional/no funcional y criterios de aceptación.
- `02_ARQUITECTURA.md`: arquitectura modular, datos, integraciones y seguridad.
- `03_BACKLOG.md`: plan incremental de implementación con gates.
- `04_DECISIONES_Y_DEPENDENCIAS.md`: pendientes, riesgos y datos necesarios.
- `05_PROMPTS_CODEX.md`: instrucciones listas para alimentar iterativamente a Codex.
- `06_ADR.md`: registro de decisiones de arquitectura (confirmadas/propuestas).
- `07_PRUEBAS_ACEPTACION.md`: ejemplos de escenarios verificables.

## Estado del descubrimiento
| Bloque | Confirmación esencial |
|---|---|
| A | Un usuario, ML primero, extensible, PC+móvil con notificaciones; plataforma indiferente. |
| B | Cuenta admin ML sin app API; MEMOSOFT exporta Excel; SKU correspondiente (declarado, pendiente comprobación); stock incierto; precio con reglas por producto; sync diaria/manual. |
| C | Crear/editar individual y masivamente; familia/producto; precio por metro/peso convertido a presentación física; agrupaciones sugeridas; datos técnicos completos; imágenes externas; videos base por familia; automatizar reglas aprobadas; optimizar y ampliar simultáneamente. |
| D | Solo preventa; sugerencia IA única, breve y editable; enviar tras aprobación desde nuestro panel; usa base técnica, FAQ e historial validado; advertir incertidumbre; aviso inmediato de toda pregunta; FAQ por aprobación; 5–7 preguntas/día sin ads y 10–15 con ads. |
| E | Precio venta MEMOSOFT con IVA; costos exportables; ARS/USD; fórmulas+excepciones; comisiones estimadas hoy; margen mínimo no fijado; cambios automáticos dentro de límites; descuentos por cantidad; redondeo indefinido; conversión a unidad física; cargos de ML variables. |
| F | Envío acordado con comprador; tres zonas/acarreos USD pendientes; tarifa solo por zona; flete paga comprador; fuera de zonas según destino; provincias comprador contrata transporte; Flex por contratar; embalajes sin relevar; preparación 1–3 días; cotización y tipo de cambio sin política. |
| G | Sin campañas activas; ads 1k–3k ARS/día tentativos; historial exportable; KPI # operaciones con rentabilidad como guardarraíl; recomendar estructura y acciones, aplicar con aprobación; comparar períodos; buscar fuentes oficiales de competencia; reportes diarios/semanales; meta tentativa 10M ARS/mes. |
| H | Hosting sin preferencia; cuentas de infraestructura personales; presupuesto TBD; 2FA; push+correo; 24/7; respaldo diario; dev/staging/prod; historial controlado; GitHub privado; dominio TBD. |

## Fuera del MVP inicial
- Bot de IA enviando respuestas sin revisión humana.
- Automatizar stock mientras no sea confiable.
- Prometer envíos a destinos no validados.
- Scraping de competidores o automatizaciones fuera de políticas.
- Publicar precios automáticamente antes de validar costos, márgenes, unidades y fees.
- Construir editor/generador gráfico de imágenes.
- Lanzar múltiples canales o una plataforma multiempresa desde el día uno.

## Antes de ejecutar Codex
1. Revisar `04_DECISIONES_Y_DEPENDENCIAS.md` y resolver los **bloqueantes del primer sprint**.
2. Proveer **muestras anonimizadas** de exportación de ML y MEMOSOFT (sin secretos de acceso).
3. Definir si se permite conectar una app API a la cuenta empresarial y titularidad/autorización.
4. Ejecutar el **Prompt 00 de exploración**; luego una tarea por vez y testear antes de avanzar.

## Fuentes técnicas de referencia (verificar vigencia durante implementación)
- OAuth: https://developers.mercadolibre.com.ar/es_ar/sobre-nuestra-api/autenticacion-y-autorizacion
- Permisos: https://developers.mercadolibre.com.ar/permisos-funcionales
- User Products: https://developers.mercadolibre.com.ar/es_ar/atributos-y-variaciones/user-products
- Costos de venta: https://developers.mercadolibre.com.ar/comision-por-vender
- Product Ads: https://developers.mercadolibre.com.ar/es_ar/product-ads-para-catalogo-y-user-products-lectura
- Seguridad de integraciones: https://developers.mercadolibre.com.ar/es_ar/como-empezar/control-de-acceso-y-autorizacion

**Nota:** este documento no autoriza de por sí modificaciones de la cuenta MercadoLibre. La habilitación técnica y la autorización de negocio son pasos independientes.
