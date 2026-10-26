# Primera prueba de Perticari

La aplicación está preparada y verificada en local. Aún no está publicada en Cloudflare. No se modificaron publicaciones, precios, stock ni mensajes reales durante el desarrollo.

## Publicación guiada desde el navegador

Usar el Worker existente `perticari-notificaiones` (nombre exacto, sin la c intermedia). La base D1 se llama `perticari-notificaciones`, con la c, y el binding es `NOTIFICATIONS_DB`.

1. Abrir el archivo de entrega `Worker_Perticari_V1.js` como texto, copiar todo. Contiene la aplicación y no lleva datos del catálogo ni claves.
2. Cloudflare → Workers & Pages → perticari-notificaiones → Edit code → reemplazar worker.js completo → Deploy. Mantener las tres variables y el binding existentes. Este es un único reemplazo; no hay que pegar cambios parciales.
3. Abrir `https://perticari-notificaiones.perticari-sa.workers.dev/connect` y entrar con PCC_ADMIN_KEY si se cerró la sesión. La autorización ML anterior se conserva si las claves y el origen no cambiaron.
4. Abrir `https://perticari-notificaiones.perticari-sa.workers.dev/app`. Configurar el segundo factor: agregar la clave mostrada a un autenticador TOTP (Google/Microsoft Authenticator, opción clave de configuración, basada en tiempo) e ingresar su código de seis dígitos. La clave se muestra solo durante la configuración; no compartirla.
5. Panel → Importar → elegir `Catalogo_inicial_Perticari.json` del paquete privado → Revisar importación → Confirmar. El paquete unifica1256códigos y200publicaciones técnicas.820códigos tienen precio en el Excel aportado. Las fechas de precios históricos quedan pendientes, sin fingir actualización actual. No importar las capturas sintéticas como datos de negocio.
6. Sincronizar ML. Revisar Configuración → Fuentes y tareas. Si la app no tiene permisos suficientes o un contrato cambió, se muestra el error. Esta es la primera prueba real del lector de esta V1.
7. Verificar Settings → Trigger events del Worker: un cron `*/15 * * * *`. Renueva OAuth y avanza tareas de lectura. El panel visible también procesa tareas pendientes y se actualiza cada30s.

## Recorrido de prueba

- Catálogo: buscar un código, filtrar familia y faltantes en ML. Revisar presentación y vínculos. Una coincidencia por SKU no garantiza identidad comercial.
- Seleccionar hasta30productos → Preparar propuestas. En Publicaciones, seleccionar un lote para aplicar descripción con `{producto}`/`{sku}`, imágenes representativas, categoría por familia y cantidad. Revisar cada presentación. No se agrupan variantes incompatibles automáticamente.
- Precios: comprobar ejemplos del 15% sobre Precio Original y el cargo fijo. Descargar propuestas CSV. Es un reporte, no una plantilla de importación oficial de ML.
- Entregas: ingresar distancia de recorrido y peso real, probar agencias. Cargar cotización USD/ARS en Configuración para ver pesos. Validar radios antes de confirmar cobertura.
- Atención: consultar preguntas; preparar una sugerencia con fuentes, editar y guardar. Esta entrega usa reglas y no un modelo externo de IA.
- Resultados: comprobar operaciones y unidades por separado. No se calcula conversión sin visitas ni rentabilidad sin costos completos.

## Piloto de escrituras

Por defecto no hay habilitación técnica de escrituras. El usuario puede aprobar acciones locales; no se convierten en éxito comercial hasta ejecutar y verificar.

Antes de habilitarlo: verificar la documentación vigente de ML y el modelo de productos de esta cuenta; validar una propuesta individual y contrastar comisiones/unidades/precios. Solo entonces configurar `PCC_ML_CONTRACT_VERIFIED=true` y `PCC_ENABLE_ML_WRITES=true` en el Worker. Los flags no reemplazan el clic de aprobación ni validan por sí solos los contratos.

Elegir una acción real para la prueba, revisar su propuesta, aprobarla y ejecutarla desde Configuración → Acciones comerciales. Ante estado incierto, revisar la cuenta de ML y reconciliar; nunca repetir el envío por otra vía sin verificar.

Los precios de variantes/User Products no se modifican mediante el escritor legacy. Las nuevas publicaciones pueden requerir un adaptador2026 distinto; si la validación indica eso, se conserva el borrador y se implementa el contrato correcto antes del piloto. Esta limitación figura en la entrega, no está resuelta por el mock.

## Reversión y recuperación

- Antes de reemplazar el Worker, conservar la versión activa en Deployments. Se puede hacer Rollback desde Cloudflare. Las migraciones solo agregan tablas; no eliminan OAuth ni notificaciones.
- Antes de una prueba con datos, hacer exportación privada de D1 mediante las herramientas de la cuenta. No subir el SQL al repo ni al chat. La automatización de backups externos y su restauración periódica sigue pendiente de la configuración operativa.
- No cambiar PCC_ADMIN_KEY/app/origen casualmente: la clave deriva el cifrado de credenciales y MFA. Si se pierde el autenticador, realizar recuperación administrativa guiada desde la cuenta de Cloudflare, invalidar sesiones y reenrolar. No hay bypass público de MFA.
