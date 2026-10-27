# Estado de V3

Revisión27/10/2026. Las pruebas usan datos sintéticos y servicios simulados; no hay credenciales de producción en este entorno ni despliegue remoto realizado.

| Área | Implementado | Verificación pendiente / límite |
| --- | --- | --- |
| MEMOSOFT | Enlace eventual, sesión, paginación descubierta, staging, promoción completa, cambios/avisos, cuatro horas y conservación ante fallo | Acceso externo desde aquí bloqueado403; comprobar lectura real en Cloudflare. Sin API oficial MEMOSOFT afirmada. |
| Preguntas | Reconciliación por ID independiente de búsqueda, historial respondido, referencias revisables, fuentes técnicas acotadas | Cobertura histórica según API; no garantía de60 días. IA requiere revisión. FAQ fijas de coincidencia exacta implementadas; se activan explícitamente tras el piloto, sin redacción autónoma de IA. |
| Preparación | Estados, archivo/restauración/descarte/eliminación segura, lotes separados, plantillas y familias seleccionables | Validar clasificación incierta antes de publicar. |
| Auditoría | Lectura remota de descripciones, imágenes, atributos y comprobaciones de datos/cobertura | No es certificación de ingeniería, rentabilidad ni ranking ML. |
| Imágenes | Propuesta desde publicaciones propias compatibles, biblioteca alojada, importación ZIP+asignación, reemplazos supervisados y reconciliación | No se fabricaron3 fotos por cada familia sin fuente real; confirmar derecho y representatividad.30MB iniciales. |
| Categorías | Nombres/rutas, selección y plantillas | Categorías/atributos se consultan con la cuenta; User Products moderno requiere contrato específico. |
| Precios | Fórmula acordada, política limitada y apagada por defecto, acumulado24h, fuente completa8h, verificación remota y avisos | Cargos oficiales y modelo deben validarse antes de activar escrituras. |
| Reparto | Mapa de polígonos, Nominatim/OSRM, cotizador ARS, cotización aceptada inmutable | Zonas deben aprobarse. Fuente BNA implementada, lectura real pendiente. Rutas orientativas de automóvil. No integración nativa del cotizador con checkoutML. |
| Publicidad | Informe con procedencia, métricas conocidas/nulas y clasificación explicada | APIProductAds y gasto no implementados hasta comprobar contrato/permisos. |
| PWA/push | Manifest, instalación compatible, suscripción cifrada, VAPID y WebPush cifrado, avisos deduplicados | Recepción real debe comprobarse en dispositivo. Proveedor/sistema operativo pueden limitar entregas. |
| Respaldo | Paquete/versionado, guía de punto de restauración D1, reversión de código | Copia externa automática/restauración desde el panel y multiusuario siguen pendientes. |

La V3 proporciona herramientas nuevas para la mudanza y operación, pero no certifica haber completado las integraciones externas ni todo el objetivo de autonomía. Los límites anteriores son visibles y no deben presentarse como funciones verificadas en producción.
