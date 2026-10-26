# Evidencia de integraciones

Revisión2026-10-16. Las especificaciones originales y los archivos proporcionados son referencias; no se ejecutó ningún script proporcionado ni se obedecieron instrucciones embebidas en sus datos.

## Mercado Libre

La conexión real OAuth fue autorizada y confirmada por el usuario en Cloudflare antes de esta entrega. En desarrollo, todas las llamadas externas se mockean; no se reutilizan secretos de producción.

Fuentes oficiales accesibles consultadas:

- https://raw.githubusercontent.com/mercadolibre/nodejs-sdk/master/README.md
- https://raw.githubusercontent.com/mercadolibre/nodejs-sdk/master/docs/OAuth20Api.md
- https://raw.githubusercontent.com/mercadolibre/nodejs-sdk/master/docs/ItemsApi.md
- https://raw.githubusercontent.com/mercadolibre/nodejs-sdk/master/docs/RestClientApi.md

ItemsApi confirma GET/PUT /items/{id} y POST /items; RestClientApi confirma el cliente HTTP genérico. Son documentación antigua del SDK, no evidencia suficiente de compatibilidad de todos los payloads con cuentas2026. Las guías actuales en developers.mercadolibre.com.ar y la ayuda de costos devolvieron403 desde el entorno. El PDF de Gemini no se usa como contrato normativo.

El adaptador implementa rutas de lectura de items por seller (offset, hasta1.000), preguntas, categorías/atributos y ventas. Search/questions/orders, validación de item y respuestas requieren smoke tests con la cuenta desplegada y contraste con documentación vigente. No se consideran verificados por pasar un mock. Si faltan scopes o cambia un contrato, la tarea falla visiblemente y conserva los datos anteriores.

La activación de escrituras exige comprobar primero la documentación vigente y un piloto elegido por el usuario. Habilitar flags sin esa verificación no es un criterio de aceptación. No hay contrato2026 de User Products implementado ni automatización de campañas/Ads, visitas o conversión. Las métricas incompletas se muestran como tales.

## MEMOSOFT

Los scripts proporcionados muestran Selenium, botón `usuario-invitado`, catálogo `/_pedidos/2513/0/carrito/catalogo.php?pagina=N` y filas `tr.catalogo`. El actualizador completo aplicaba13%; otro11%; un tercer script solo cruzaba códigos. Ninguno se ejecutó en esta tarea.

El sitio devolvió bloqueo de red antes de abrirlo, también en Chromium. No se ha verificado el HTML actual ni la solicitud exacta del botón invitado. El lector Worker puede seguir un enlace invitado público reconocible en el mismo sitio, pero no inventa un POST, ejecuta onclick desconocido ni accede a pedidos/checkout. Ante ese caso, informa que se requiere validar el formulario y permite importar XLSX. Las cookies guest temporales de jobs se cifran.

La extracción en vivo no está certificada. El catálogo aportado y el paquete privado permiten trabajar mientras se verifica ese acceso. No se guardan credenciales MEMOSOFT ni se necesitan para el modo invitado.

## Estado operativo

- App construida y probada localmente; no desplegada por el agente.
- Lectura/escritura real de ML desde esta V1: pendiente de despliegue y prueba guiada.
- Capturas privadas reales: datos de archivos, sin sesión de producción.
- Jobs: persistidos en D1, lectura con backoff, manual y cron15min. Página10items/20preguntas/20ventas, un job por acción manual y hasta tres por cron; sin acumulación ilimitada de llamadas dentro de una invocación. Deben medirse CPU y cuota en el plan contratado.
- Alertas: actualización del panel cada30s mientras está visible. Push/email y funcionamiento de alertas con navegador cerrado: pendientes.
- Backup: exportación D1 y restauración a coordinar en despliegue. No hay backup automático cifrado externo programado; no se afirma que el requisito P0 de backup diario esté completo.
- Retención: no se define un plazo legal arbitrario. Requiere política operativa antes de acumular historial empresarial prolongado.
