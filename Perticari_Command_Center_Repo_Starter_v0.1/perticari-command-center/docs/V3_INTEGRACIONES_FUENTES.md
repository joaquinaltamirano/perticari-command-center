# V3: fuentes de cambio, geocodificación, rutas y publicidad

Revisión: 26/10/2026. Se distingue contrato documentado, implementación local y verificación real.

| Función | Evidencia y comportamiento |
| --- | --- |
| BNA, dólar billete vendedor | Adaptador del HTML oficial de `https://www.bna.com.ar/Personas`. Requiere identificar sección billetes, fila dólar, columna venta y fecha; nunca utiliza divisa por semejanza. Consulta horaria, conserva último valor ante fallo y expone el error. Pruebas locales sintéticas. Acceso al sitio oficial y a `/Cotizador/MonedasHistorico` bloqueado por túnel 403 en este entorno; lectura real pendiente en Cloudflare. |
| Nominatim | Contrato de búsqueda verificado en el repositorio oficial: https://raw.githubusercontent.com/osm-search/Nominatim/master/docs/api/Search.md. Confirma `/search`, `q`, `format=jsonv2`, `countrycodes` y `limit`. Habilitación explícita desde el panel, consultas argentinas, máximo 5 resultados, límite global de una solicitud por más de un segundo, caché de un día y atribución a OpenStreetMap. No hay autocompletado masivo. El proveedor recibe la dirección buscada. |
| OSRM | Contrato verificado en https://raw.githubusercontent.com/Project-OSRM/osrm-backend/master/docs/http.md. Confirma `/route/v1/driving/{coordenadas}`, `overview=false`, distancia y duración. Habilitación explícita, consultas manuales limitadas, URL fija HTTPS. Ruta orientativa de automóvil: no certifica circulación de camiones, dimensiones ni capacidad de entrega. Servicio público de demostración sin garantía de disponibilidad; para uso intensivo hace falta proveedor/servidor dedicado. |
| Zonas | Polígonos privados introducidos y aprobados por Perticari, no radios inventados. Referencias originales y tres tarifas USD conservadas. Bordes, superposición y direcciones aproximadas requieren revisión. |
| Cotización aceptada | Guarda tarifa USD, cambio, fuente, ubicación, fecha y vencimiento. No recalcula retroactivamente ante un nuevo dólar. Una zona modificada invalida la aceptación de propuestas anteriores. |
| Publicidad | Importación de informe con período, procedencia y métricas explícitas; los valores desconocidos quedan nulos. Clasifica descubrimiento, ganadoras o revisión. No ejecuta gasto. Los SDK oficiales antiguos solo verifican el cliente genérico, no contratos actuales de Product Ads. Las páginas oficiales `product-ads`, `publicidad` y `gestionar-campanas` devolvieron 403; no se habilita una API deducida de rutas no verificadas. |

## Importación de métricas

`POST /api/pcc/v3/integrations/ads/import` recibe `report` con `source`, `period_start`, `period_end` y `rows`. Cada fila tiene `item_id` y, cuando se conocen, `visits`, `clicks`, `orders`, `impressions`, `spend_cents`, `attributed_sales_cents`.

Es un formato de intercambio del Command Center, no la afirmación de que una exportación nativa de ML tenga exactamente esos encabezados. Verificar/mapping de columnas antes de importar. No mezclar ventas totales y ventas atribuidas. Una publicación con visitas pero sin ventas queda para revisión, no se promociona automáticamente.

`GET /api/pcc/v3/integrations/state` identifica publicidad como `file_imported` o `pending`, y `ads_read: false`; no presenta una carga manual como sincronización API. La lectura remota Product Ads permanece pendiente de contrato y permisos verificados.

## Configuración de mapas

`POST /api/pcc/v3/integrations/providers/save` permite habilitar búsquedas y rutas con `external_lookup_acknowledged: true`. No requiere compartir claves. Se conserva la elección del propietario. El botón de búsqueda envía al proveedor solo lo ingresado; las coordenadas y cotizaciones se almacenan en la base privada protegida por la autenticación del panel.

Alternativamente se puede habilitar mediante `PCC_GEOCODING_ENABLED=true` o `PCC_ROUTING_ENABLED=true` en Cloudflare. La interfaz sigue informando el proveedor utilizado.
