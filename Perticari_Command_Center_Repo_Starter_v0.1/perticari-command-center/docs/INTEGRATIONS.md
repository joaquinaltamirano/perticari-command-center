# Integraciones V2 y evidencia

Revisión: 2026-10-20. Complementa FUENTES_Y_LIMITES.md, que describe la entrega histórica V1.

| Integración | Implementación local | Verificación real en esta entrega |
| --- | --- | --- |
| OAuth ML | Conservado, renovación y cifrado existentes | Conexión previa reportada por dueño; sin acceso a sus secretos |
| Preguntas ML | Search pendientes, reconciliación individual, notificaciones, fechas, tratamiento 404/410/403 y backoff | Contrato cubierto por simulaciones; smoke en cuenta pendiente |
| Items ML | Lectura paginada hasta 1.000, SKU/variantes, preflight tradicional | User Products moderno y escritura piloto pendientes |
| Órdenes ML | Lectura de últimas 20 cada 10 min y revisión diaria hasta 1.000; evento orders_v2 | Pruebas simuladas; sin datos de compradores persistidos |
| MEMOSOFT | Enlace o formulario invitado observado, cookies, redirecciones restringidas, filas tr.catalogo, corte de sesión/página repetida | Sitio inaccesible desde entorno; requiere comprobar HTML actual en Cloudflare |
| OpenAI | Chat Completions con JSON Schema, contexto reducido, citas, reserva de presupuesto y fallos | SDK oficial consultado, pruebas simuladas; sin credencial ni llamadas pagas reales |
| Product Ads / visitas / reputación | Registro de hipótesis y resultados manuales; sin llamadas de estos recursos | API y permisos pendientes; no se simulan métricas ni ejecución |
| WhatsApp / push / PWA | Extensiones previstas | No implementadas en V2 |

## Evidencia consultada

- SDK oficial OpenAI: https://raw.githubusercontent.com/openai/openai-node/master/src/resources/chat/completions/completions.ts (accesible, endpoint /chat/completions, response_format JSON Schema, max_completion_tokens).
- SDK oficial ML: https://raw.githubusercontent.com/mercadolibre/nodejs-sdk/master/docs/RestClientApi.md (accesible; referencia genérica antigua, insuficiente para contratos modernos).
- Guía actual ML de preguntas: https://developers.mercadolibre.com.ar/es_ar/preguntas-y-respuestas (403 desde entorno).
- MEMOSOFT público invitado: https://www.memosoft.net.ar/_pedidos/2513/0/index.php (bloqueo de túnel 403).
- Worker desplegado del dueño: /health también bloqueado desde este entorno. No se inspeccionó su estado privado ni se sustituyó código remoto.

Las afirmaciones del prompt maestro sobre cambios de APIs en 2026 no se aceptan como contrato verificado por sí solas. Los fixtures reproducen contratos esperados y nunca certifican permisos de una cuenta.

## Operación programada

Cron de 1 minuto, con exclusión de ticks duplicados. Cola con prioridad de eventos/preguntas y tres trabajos como máximo por invocación. Reconciliación de tres preguntas por trabajo y persistencia de páginas por lotes. Al fallar búsqueda de preguntas, enfriamiento de cinco minutos para evitar nuevas oleadas; el reintento manual continúa disponible.

Publicaciones: página de 10, hasta 1.000. Preguntas: páginas de 20 y cobertura limitada a 1.000 pendientes en una búsqueda; reconciliación local por ID en cadenas. Ventas recientes: solo primera página de 20, para evitar cadenas repetidas cada diez minutos. Historial diario: hasta 1.000, sin afirmar historia completa. No hay cancelación ni cambios de órdenes remotos.

Los fallos se ven en fuentes y trabajos. Una lectura temporal se reintenta con backoff; errores de permisos exigen corrección. Trabajos terminados/fallidos se conservan. No se fijó una política automática de borrado de datos comerciales sin acuerdo del propietario. Vigilar crecimiento de D1 y cuotas reales del plan; no se promete gratuidad ilimitada.

La salud pública indica receptor persistente y procesamiento asincrónico implementado; los permisos y la frescura de cada fuente se consultan en el panel privado.
