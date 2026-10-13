# SRS — Especificación de requisitos de software v0.1

## 1. Objetivo y criterios de éxito
**Sistema:** Perticari Command Center (PCC).  
**Usuario inicial:** administrador único.  
**Objetivo operativo:** centralizar y acelerar la administración de la cuenta MercadoLibre; ampliar catálogo y acelerar la atención sin exponer a la empresa a respuestas inventadas, errores masivos de precios o promesas logísticas incorrectas.  
**Objetivo comercial:** cantidad de operaciones como KPI principal, con rentabilidad y reputación como restricciones; meta de facturación de ARS 10M/mes **tentativa**, no pronóstico.

Indicadores propuestos: número de ventas/operaciones completadas; ventas netas; margen de contribución estimado; visitas/publicación; conversión; preguntas pendientes; mediana y p90 de tiempo hasta respuesta; errores de sincronización; porcentaje de SKU reconciliados; actualización de precios vencida; costos ads por compra; tiempo humano por consulta.

## 2. Usuarios y permisos
- ADMIN único en el MVP. Login con MFA obligatorio, sesiones seguras y opción de revocar sesión.
- La autorización se verifica *en backend* en cada operación. Dejar posibilidad de extender a roles, pero **no desarrollar panel de usuarios** inicialmente.
- Una cuenta MercadoLibre de Perticari vinculada a través de autorización OAuth. No almacenar contraseña de ML.

## 3. Requisitos funcionales
**Prioridades:** P0 = primer núcleo operativo; P1 = primera expansión; P2 = posterior. Un requisito marcado P0 no implica que pueda desplegarse sin su dependencia indicada.

### F0 — Integración y sincronización
- **FR-001 (P0):** importar catálogo MEMOSOFT desde XLSX/CSV y preservar archivo origen, hash, fecha, errores y registro de importación.
- **FR-002 (P0):** vista previa de importación; detectar columnas ausentes, SKU duplicado, producto sin unidad, valores negativos y monedas inválidas. Confirmar importación de forma explícita.
- **FR-003 (P0):** conectar MercadoLibre mediante OAuth del lado servidor; cifrar tokens y manejar renovación, expiración y revocación.
- **FR-004 (P0):** lectura y conciliación de publicaciones, SKU, variaciones/User Products, estado y precios; marcar discrepancias sin corregirlas automáticamente.
- **FR-005 (P0):** botón `Sincronizar ahora` + programación diaria; cada fuente mostrará su última sincronización efectiva y nivel de frescura. La actualización diaria de MEMOSOFT requiere acceso automático al Excel; si no existe, programar recordatorio de importación y **no simular que se sincronizó**.
- **FR-006 (P0):** registro persistente de errores, reintentos, límites de API, duplicados y operaciones parcialmente completadas.

### F1 — Dashboard
- **FR-010 (P0):** vista PC y móvil de pendientes, preguntas, estado conexión, salud de sincronización, acciones prioritarias y alarmas.
- **FR-011 (P1):** centro de decisiones con recomendaciones explicadas, datos fuente, confianza y acción posible.
- **FR-012 (P1):** indicadores diarios/semanales con comparación histórica y filtros de período, familia y publicación.

### F2 — Atención preventa con IA
- **FR-020 (P0):** recibir notificaciones/polling de preguntas preventa, persistirlas, asociarlas a publicación y SKU, deduplicar eventos.
- **FR-021 (P0):** generar **una** respuesta breve, directa y editable usando datos de publicación, ficha técnica y documentación validada; no incluir ni inferir información no confirmada.
- **FR-022 (P0):** mostrar avisos cuando falte stock verificado, información logística, medidas, costos u otra evidencia; el humano decide el texto final.
- **FR-023 (P0):** envío desde manager **solo tras acción explícita del administrador**, verificando estado de pregunta y respuesta de API. Nunca envío autónomo por IA.
- **FR-024 (P0):** alertas inmediatas por cada pregunta nueva vía PWA/push cuando sea posible y email de respaldo; deduplicar notificaciones.
- **FR-025 (P1):** documentación comercial, FAQ y respuestas históricas aprobadas; búsqueda con procedencia para fundamentar respuestas.
- **FR-026 (P1):** sugerir nueva FAQ a partir de correcciones; solo incorporar a base de conocimiento tras aprobación explícita.
- **FR-027 (P0):** prohibir afirmaciones comerciales no soportadas, contenido de contacto indebido y ejecución de instrucciones incluidas por compradores en los textos como si fueran órdenes para la IA.

### F3 — Catálogo y publicaciones
- **FR-030 (P0):** modelo de Familia, Producto, Variante/SKU, Presentación Comercial y Publicación externa, con atributos de unidad, peso, largo, título, descripción y estado.
- **FR-031 (P1):** editar fichas y preparar cambios individuales o lotes; previsualizar diferencias y permitir ejecutar solo cambios permitidos por API y autorizados.
- **FR-032 (P1):** crear nuevas publicaciones y sugerir agrupaciones de variantes con aprobación humana; verificar atributos/condiciones exigidas por categoría y modelo UP.
- **FR-033 (P1):** adjuntar imágenes producidas externamente y gestionar videos base por familia/variantes, sujetos a operaciones disponibles de ML.
- **FR-034 (P1):** auditoría por item: origen de campos, última edición, valor previo, valor enviado, resultado y errores.
- **FR-035 (P1):** expansión de productos y optimización de los existentes en paralelo; alertar familias poco representadas y posibles duplicados.

### F4 — Pricing Engine
- **FR-040 (P0):** leer precio venta MEMOSOFT con IVA, costos de adquisición, moneda (ARS/USD) y reglas/overrides por SKU.
- **FR-041 (P0):** convertir precio por metro/kg a unidades físicas de publicación según reglas de longitud, peso, cantidad, unidad de facturación y embalaje verificadas.
- **FR-042 (P0):** cotizar gastos aplicables usando API oficial de costos de venta cuando el conjunto requerido de parámetros está disponible; si no, marcar el costo como estimado o pendiente.
- **FR-043 (P0):** separar IVA, costo, comisión, costos logísticos, descuentos y contribución económica sin doble contabilización; fijar fórmula aprobada antes de activar operaciones.
- **FR-044 (P0):** `dry-run`/simulación de diferencias sin modificar ML y exportar resultado por SKU/item.
- **FR-045 (P1, BLOQUEADO):** cambios automáticos solo dentro de reglas previamente aprobadas, con topes, margen mínimo, datos frescos, manejo de excepción y resultado auditado; no habilitar hasta validar márgenes y conversiones.
- **FR-046 (P1):** descuentos por cantidad según elegibilidad/categoría y API vigente, sin permitir resultado por debajo de margen autorizado.
- **FR-047 (P0):** soporte de tipos de cambio versionados, con hora/fuente/aprobación; ninguna conversión automática si falta cotización válida.

### F5 — Logística
- **FR-050 (P1):** tres grupos de acarreo con precios USD y cobertura verificada por zona; comprador paga flete.
- **FR-051 (P1):** opcionalmente asociar radios, polígonos y localidades; resolver solapamientos y excepciones sin inferir tarifa desde distancia no validada.
- **FR-052 (P1):** destinos fuera de zona requieren confirmación; provincias: transporte contratado por comprador; preparar despacho en Barracas.
- **FR-053 (P1):** plazo de preparación 1–3 días separado del plazo de entrega; no prometer ETA por defecto.
- **FR-054 (P2):** estudiar ME1 para voluminosos y Flex para cajas; habilitar solo con proveedor y condiciones confirmadas.
- **FR-055 (P1):** tarifas USD→ARS sujetas a cotización aprobada; cotización comercial pasa a estado «confirmada» únicamente con cobertura y costo vigentes.

### F6 — Crecimiento y publicidad
- **FR-060 (P1):** importar histórico de ventas/visitas/publicidad y almacenar métricas periódicamente para análisis longitudinal.
- **FR-061 (P1):** informes diarios y semanales por operaciones, familia, contribución y publicidad, comparando períodos equivalentes.
- **FR-062 (P1):** recomendar estructura de campañas/altas/pausas según rentabilidad, demanda y muestras suficientes.
- **FR-063 (P2):** modificar campañas con aprobación explícita únicamente si las operaciones están disponibles y autorizadas por API vigente; de otro modo presentar instrucciones para ejecución en ML.
- **FR-064 (P2):** integrar señales competitivas de fuentes oficiales y referencias manuales; no crawling no autorizado.
- **FR-065 (P1):** registro de intervenciones comerciales y comparación pre/post sin atribuir causalidad de forma automática.

### F7 — Administración y mantenimiento
- **FR-070 (P0):** monitor de salud de API ML, worker, cron de sincronización, envío correo/push y errores persistentes.
- **FR-071 (P0):** audit log con usuario, timestamp, operación, recurso, resultado y cambios mínimos necesarios (sin registrar tokens).
- **FR-072 (P0):** backups diarios cifrados con política de retención, almacenamiento separado y prueba periódica de restauración.
- **FR-073 (P0):** entornos de desarrollo, staging y producción aislados; no permitir credenciales reales en tests por defecto.
- **FR-074 (P0):** datos personales/historial comercial con acceso restringido, retención y eliminación definibles; minimizar datos que se envían al proveedor de IA.

## 4. Requisitos no funcionales (objetivos técnicos propuestos; aún no aprobados como SLA)
- Responsive: tareas principales utilizables en PC y smartphone; performance con datos paginados.
- Seguridad: HTTPS, autenticación MFA, permisos backend, tokens cifrados y secretos fuera del repositorio.
- Disponibilidad: arquitectura capaz de procesar eventos 24/7; **disponibilidad real depende del proveedor y presupuesto**. Alertar sobre interrupción, evitar pérdidas de eventos mediante reconciliación.
- Consistencia: importación repetida del mismo archivo sin duplicación; eventos webhook repetidos sin respuestas duplicadas; operaciones masivas recuperables.
- Reproducibilidad: usar precisión decimal para dinero, ISO timestamps con zona, tipos explícitos de moneda y unidad.
- Trazabilidad: correlación SKU ↔ publicación/UP ↔ fuentes de costo ↔ decisión ↔ acción externa.
- Privacidad: acceso del dueño del sistema no sustituye autorización de uso de datos de compradores/empresa; respetar políticas aplicables.
- Backup: automático diario y **restauración comprobada**; retención/cantidad de días pendientes de acuerdo de negocio.

## 5. Reglas de negocio esenciales
1. Ninguna pregunta IA se publica sin clic de aprobación humana y chequeo del estado remoto.
2. Ningún stock desconocido se presenta como disponible confirmado.
3. Ninguna tarifa por acarreo se infiere de un radio propuesto sin matriz validada.
4. Ningún lote de precios se ejecuta si hay cambio de unidad, margen menor a mínimo, cotización no vigente, fee incompleto o discrepancia de SKU.
5. Una API puede negar un cambio aunque el usuario lo solicite; dejar la operación como fallida/pendiente, no como éxito.
6. Guardar diferencia entre precio base de MEMOSOFT, precio de publicación y rentabilidad calculada; no sobrescribir las fuentes.
7. Solo reglas explícitamente aprobadas pueden actuar sin revisión de cada SKU; permitir detener automatizaciones.

## 6. Restricciones y supuestos
- SKU correspondidos según usuario, **sin revisión del Excel aún**.
- Stock sin calidad certificada.
- No hay aplicación API creada; se debe validar titularidad y permisos.
- No se cuenta aún con tarifas y cobertura definitivas, política de moneda/flete, presupuesto operativo ni proveedor Flex.
- ML mantiene modelos legacy y User Products; usar adaptador y capacidades comprobadas por cuenta.
- Product Ads y fees cambian: verificar documentación vigente antes de implementar endpoints.
- Titularidad de servicios personales puede coexistir con datos empresariales solo si hay autorización, controles y plan de continuidad acordados.

## 7. Criterio global de aceptación MVP
El administrador puede iniciar sesión con MFA; importar y reconciliar catálogo con publicaciones reales sin sobrescribir datos; visualizar preguntas nuevas y recibir alertas; leer una sugerencia breve de IA basada en fuentes, editarla y enviarla tras aprobación; observar confirmación real del envío; ejecutar pricing en modo simulación con estado de incertidumbre y logs; y ver un dashboard de estado y errores. La aplicación funciona en PC y móvil. No hay actualización automática de stock ni precio en producción durante el piloto.
