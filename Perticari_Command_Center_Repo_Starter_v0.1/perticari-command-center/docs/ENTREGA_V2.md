# Entrega V2 — operación asistida

La V2 está implementada y validada localmente; no fue desplegada por el agente. Su actualización conserva la base y las credenciales existentes. Instrucciones en PROBAR_V2.md.

## Cambios principales

- Preguntas antiguas: se contrastan por ID aunque desaparezcan de la búsqueda UNANSWERED. Estados remotos, fechas, errores y última reconciliación visibles. Respuestas desde ML se reflejan en el panel; fallos no inventan cierres.
- Actualización ligera cada 15 s, refresco al volver a la ventana y protección frente a respuestas antiguas que lleguen después. Catálogo completo se consulta al cambiar sus fuentes, no en cada intervalo.
- Cron cada minuto; eventos despiertan la cola, atención prioritaria, ventas recientes e historial separados, persistencia por lotes y reintentos controlados.
- Pedidos operativos: confirmar disponibilidad real, preparación, coordinación, entrega, notas y excepciones. Pausa supervisada de publicaciones afectadas, sin cancelar pedidos.
- Conocimiento validado: fuente, vigencia, familia, versiones y estado. Respuestas desde reglas/conocimiento o IA opcional. Feedback y posibilidad de proponer conocimiento desde una corrección; validación humana requerida.
- OpenAI opcional: modelo y tarifas configurables, contexto mínimo, salida estructurada, identidad de citas comprobada, presupuesto diario reservado atómicamente y registro de uso. Nunca envía mensajes automáticamente.
- Oportunidades por producto/familia con criterio explicable, evidencia y bloqueos. Registro de experimentos y propuestas publicitarias sin gasto automático.
- Precios públicos de MEMOSOFT identificados correctamente. Diferencias de importación e historial. Escenario de costos del canal sin presentar ganancias ficticias.
- Controles de solo lectura, pausa de trabajos y apagado IA. Aprobaciones con vencimiento y reconciliación por lectura para resultados inciertos. Migración aditiva.

## Verificación y límites

90 pruebas aprobadas y navegador en escritorio/móvil con datos iniciales privados. Ver TESTING.md para comandos y alcance.

La especificación completa incluye capacidades futuras. User Products moderno, tarifas oficiales, Ads, visitas, envíos/reclamos/reputación y MEMOSOFT en vivo requieren verificaciones externas. Multiusuario, autonomía comercial, WhatsApp/push, gestión multimedia avanzada y backup automático externo permanecen en ROADMAP.md. No se afirma que todo el operador autónomo esté terminado.

No se contrataron servicios, consumieron llamadas pagas reales ni ejecutaron acciones comerciales/productivas. Ningún dato de comprador, secreto o exportación privada fue incorporado al código.

## Entrega y recuperación

Archivo único Worker listo para el editor Cloudflare, ZIP de actualización, fuente y documentación. Misma URL /app, mismo callback y misma D1. La primera carga privada crea nuevas tablas. No reimportar el catálogo para actualizar. El código de V1 continúa compatible con las columnas preexistentes si se necesita revertir un despliegue; las tablas nuevas se conservan.

Prioridad al instalar: comprobar una pregunta respondida fuera del panel, revisar Fuentes, confirmar cron y luego probar pedidos/conocimiento. Las escrituras comerciales continúan bajo piloto explícito.
