# Instrucciones de Perticari Command Center

## Fuente de verdad y alcance

- Leer los ocho documentos de `specs/` antes de la primera tarea. Son la base v0.1; distinguir requisitos confirmados, propuestas y pendientes.
- Leer `docs/SPRINT_00.md`: contiene observaciones propuestas, no cambios aprobados de la base.
- Seguir la tarea y el alcance autorizado por el Product Owner. No repetir el relevamiento A–H. La preparación documental no autoriza implementar todo el sistema.
- Ante contradicciones, explicarlas y proponer resolución; no resolverlas inventando reglas de negocio. Una vez autorizado un hito, avanzar dentro de él sin pedir permiso para cada paso rutinario.

## Arquitectura y datos

- Favorecer un monolito modular mantenible por una persona. Separar dominio, persistencia e integraciones; no introducir microservicios sin necesidad demostrada.
- No inventar columnas de Excel, tarifas, stock, pesos, tasas, márgenes, endpoints ni capacidades de ML. Usar estados pendientes y fixtures explícitamente sintéticos.
- Dinero y conversiones: precisión decimal, moneda y unidades explícitas. SKU interno no implica una sola publicación o presentación. Stock desconocido no equivale a disponible.
- Verificar documentación oficial vigente antes de implementar una integración. Documentar fuentes y diferencias respecto de las especificaciones.

## Acciones externas

- Lectura → validación → propuesta → simulación → aprobación o regla autorizada → ejecución → verificación → auditoría.
- Toda respuesta de IA requiere aprobación explícita del administrador. La IA no envía mensajes, aprueba FAQ ni modifica reglas por iniciativa propia.
- No escribir en la cuenta real de ML sin autorización de negocio y habilitación técnica. Precio/stock automáticos siguen bloqueados hasta validar sus dependencias.
- Staging y tests usan mocks o cuentas de prueba; no emplear credenciales de producción por defecto. Aislar permisos y conexiones además de desactivar flags de escritura.
- Importaciones/jobs idempotentes; ante un envío con resultado incierto, reconciliar antes de reintentar. No confundir respuesta HTTP con resultado comercial confirmado.

## Seguridad y entrega

- No versionar secretos, `.env`, exportaciones comerciales crudas ni datos personales. No mostrar tokens ni PII en logs, capturas o prompts. Minimizar información enviada a la IA.
- Validar entradas y autorización en backend; datos privados requieren autenticación con MFA en el entorno operativo.
- Una tarea coherente por rama/PR. No sobrescribir trabajo ajeno ni fusionar o desplegar fuera del alcance autorizado.
- Hoy este repo es documental: no hay runtime ni tests de aplicación. No afirmar que se ejecutaron. Al implementar, documentar versiones, comandos reales, migraciones y pruebas proporcionadas al riesgo.
- Reportar: requisitos cubiertos, archivos cambiados, decisiones, comandos y resultados, limitaciones, reversión y siguiente paso. Usar la plantilla de PR.
