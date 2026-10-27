# Instalar y probar V3

La instalación conserva el Worker existente `perticari-notificaiones`, su D1 y las claves. No crear otra aplicación ML, rotar secretos ni borrar tablas. Este paquete no contiene datos comerciales.

1. Descargar `Perticari_V3_actualizacion.zip` desde `releases/v3/` en GitHub y extraerlo. Si el ZIP no abre, el mismo directorio ofrece `Worker_Perticari_V3.js` por separado: abrirlo y copiar todo su contenido.
2. En Cloudflare: Workers & Pages → `perticari-notificaiones` → Edit code. Reemplazar el contenido completo por `Worker_Perticari_V3.js` → Deploy. Hacer antes una copia/restauración de referencia de D1 desde el panel de Cloudflare; las tablas V3 se crean sin borrar las existentes.
3. Settings → Trigger events → Cron: comprobar `* * * * *` (cada minuto). El archivo wrangler lo declara, pero pegar código en el editor no configura el cron automáticamente.
4. Abrir https://perticari-notificaiones.perticari-sa.workers.dev/app y recargar con Ctrl+F5. Debe mostrar V3. Para comprobar la compilación: abrir `/app/assets/version.json`. Ingresar con la misma contraseña y segundo factor.

## Primera prueba

- Publicaciones → Familias y mudanza: revisar la lista del esquema aportado, elegir una familia y preparar hasta30 faltantes. Revisar una muestra. Categoría, unidad, atributos e imágenes deben corresponder al producto; el sistema no inventa medidas.
- Publicaciones → Preparación: elegir propuestas, archivar, ver Archivadas y restaurar. Descartar permite retirar trabajo pendiente; eliminar solo funciona con borradores sin operaciones comerciales. Los grupos de lotes tienen su propia administración, separada del borrador y de ML.
- Publicaciones → Auditoría general: consultar nombres de categorías y auditar lo ya publicado. Una auditoría local de datos importados no sustituye la lectura remota: errores o descripciones no consultadas quedan identificados.
- Imágenes y plantillas: seleccionar familia/subfamilia, revisar el conjunto propuesto desde publicaciones existentes, confirmar procedencia/representatividad y guardar una plantilla. No hay fotos ficticias precargadas. Si faltan fotos compatibles, el conjunto queda pendiente.
- ZIP: JPEG/PNG/WebP de hasta450KB, máximo30 imágenes y3MB descomprimidos. La biblioteca inicial aloja hasta30MB. Se admite `manifest.json` con `images:[{filename,sku,position}]`. Importar primero; preparar reemplazos después; revisar y confirmar las modificaciones reales en Publicaciones → Reemplazos de contenido.
- Centro de decisiones → Respuestas históricas: importar y elegir ejemplos para revisar como referencia. Guardarlos como validados solo si sus condiciones siguen vigentes. Consultar fuente técnica admite páginas HTML/texto de fabricantes habilitados; una ficha PDF requiere extracción/manual.
- Configuración → Consultar MEMOSOFT: seguir progreso en tareas. La versión vigente se conserva hasta completar todas las páginas. Para programación, habilitar la consulta cada cuatro horas en Centro de decisiones → Controles e IA. El acceso real debe comprobarse desde este Worker; este entorno no pudo conectarse al sitio.
- Fuentes y reparto: consultar BNA, habilitar mapas, dibujar y aprobar zonas. Ubicar origen de reparto y destino mediante búsquedas, seleccionando las ubicaciones correctas antes de pedir recorrido. El dato vial orienta; no certifica restricciones de camión. Probar dentro/fuera/borde de cada zona. Una cotización aceptada conserva el importe usado.
- Automatización y avisos: revisar excepciones y suscribirse a notificaciones. El navegador debe permitirlas; en móviles, instalar como aplicación cuando el navegador lo ofrezca. Probar recepción con la pestaña cerrada. No se cachean respuestas privadas.

## Escrituras y automatismos

La lectura y preparación funcionan sin activar escrituras. El piloto exige `PCC_ENABLE_ML_WRITES=true` y `PCC_ML_CONTRACT_VERIFIED=true`, configurados solamente después de verificar el contrato/modelo de publicación aplicable y revisar el lote. No habilitar esos valores para disimular un403 ni para evitar validar User Products.

Mantenimiento automático: presentación y fuentes confirmadas, cargos revisados, lectura MEMOSOFT completa de hasta8h y publicaciones concretas seleccionadas. Política inicialmente desactivada. Al activar, máximos5% por cambio y suma absoluta10% en24h. Promociones, variantes/modelos sin contrato, fuente vencida o resultado incierto se derivan a excepción. Se conservan pausas generales de trabajos y de escrituras.

Publicidad directa por API sigue pendiente; la versión permite importar informes con procedencia y clasificarlos, sin gasto automático. No se promete introducir un cotizador propio dentro del checkout de ML.

## Ante un problema

Anotar pantalla, acción y mensaje. No enviar secretos, contraseñas ni tokens. Una petición comercial de resultado incierto no se repite: consultar la reconciliación. Si es necesario volver al código V2, usar una versión anterior desde Deployments; eso no revierte cambios ya realizados en ML ni restaura automáticamente la base. Para la base, usar la copia/punto de restauración de Cloudflare.
