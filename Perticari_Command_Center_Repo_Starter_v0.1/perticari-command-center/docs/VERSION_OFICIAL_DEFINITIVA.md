# Perticari Command Center — especificación definitiva del producto

Versión funcional 1.0 · Alcance congelado antes de implementación.

## 1. Estado, autoridad y propósito

Este documento consolida el prompt maestro y las decisiones posteriores del propietario. Define qué construir; no certifica funciones ya implementadas ni autoriza desplegar, escribir en Mercado Libre, enviar mensajes o contratar servicios. La tarea actual es exclusivamente documental. La implementación comienza cuando el propietario la indique.

Prevalece sobre interpretaciones anteriores en los puntos aquí aclarados, especialmente precios. Los documentos históricos se conservan como antecedentes. Cambios posteriores de alcance o política deben registrarse explícitamente. Un dato comercial pendiente no se convierte en confirmado por aparecer en esta especificación.

Objetivo: administrar y hacer crecer un canal de Mercado Libre sustancialmente mayor sin aumentar proporcionalmente el trabajo humano. Combinar expansión de oferta, calidad, atención rápida, operación confiable y publicidad medible.

Meta inicial: avanzar de aproximadamente 200 a 800 publicaciones válidas y activas, si el catálogo y el modelo de Mercado Libre lo permiten. Medir también productos, presentaciones y medidas disponibles: una variante no equivale necesariamente a una publicación independiente. No crear duplicados para cumplir una cifra.

Hipótesis comercial del propietario: ampliar la oferta, mejorar calidad, contestar más rápido y sumar campañas puede aumentar significativamente las ventas. Es una hipótesis que se medirá; no una garantía. Las 5–6 preguntas diarias reportadas son una referencia inicial, no prueba de baja visibilidad: también pueden influir demanda, contenido, precio, logística y compras sin preguntas.

## 2. Base existente que se debe conservar

V1 en Cloudflare Workers y D1, con catálogo, importaciones, borradores de hasta 30 productos, plantillas, precios, cotizador, atención por reglas, tablero, auditoría, acceso y MFA. OAuth fue conectado previamente. Existen pruebas locales y simulaciones; no asumir validación de todas las operaciones reales.

Datos importados de referencia: 1.256 códigos, 200 publicaciones y 820 precios de origen. No son stock ni datos necesariamente vigentes. La interfaz y módulos útiles se evolucionan; no se reescribe por preferencia tecnológica.

Antes de implementar: auditar repositorio, ejecutar pruebas, identificar capacidades reales, revisar esquema y migraciones, y documentar integraciones verificadas, parciales y simuladas. Corregir documentación obsoleta que aún describa el repositorio como exclusivamente documental.

## 3. Día de trabajo y navegación

La pantalla Inicio muestra pendientes ordenados por urgencia e impacto: ventas por confirmar, consultas próximas a vencer, fallos de sincronización, precios pendientes, propuestas de publicación y oportunidades comerciales. Cada tarjeta permite actuar o abrir su evidencia.

El operador puede:

1. Revisar el resumen de actividad desde su última visita.
2. Confirmar disponibilidad de pedidos y gestionar excepciones.
3. Revisar respuestas preparadas y enviarlas con aprobación.
4. Aprobar cambios de precios y lotes de publicaciones.
5. Evaluar oportunidades y propuestas publicitarias.
6. Consultar qué se ejecutó, qué falló y qué resultado produjo.

Espacios funcionales: Inicio; Catálogo y publicaciones; Precios; Atención; Pedidos y logística; Crecimiento; Centro de decisiones/IA; Configuración. Reutilizar navegación de la V1 y evitar duplicación de pantallas.

Diseño profesional, sobrio, responsive, con filtros persistentes, selección por lotes, estados claros, vistas previas y acceso directo a excepciones. Cada indicador informa fecha, fuente y cobertura. Nunca completar huecos con métricas ficticias.

## 4. Fuentes y calidad del conocimiento

MEMOSOFT es fuente de catálogo y precios de venta al público. Integración directa de invitado a verificar desde el entorno definitivo; importaciones siguen disponibles. No usar precios históricos inconsistentes del maestro.

Mercado Libre es fuente del estado remoto de publicaciones, categorías, atributos, preguntas, pedidos y demás recursos efectivamente disponibles para la cuenta. Fichas técnicas, políticas aprobadas y correcciones humanas complementan el conocimiento.

Cada dato sensible conserva origen, momento de obtención, validación, vigencia, unidad y estado de conflicto. Mantener historial y una regla explícita de precedencia por campo. Una importación antigua no sobrescribe silenciosamente información remota más reciente.

SKU, producto, presentación, publicación, variante y User Product son entidades vinculadas, no sinónimos. Las equivalencias inciertas requieren revisión. Detectar duplicados, inconsistencias de medidas y precios ausentes.

Conservar la última información ante caídas, mostrando antigüedad. Bloquear acciones afectadas por falta de datos o vigencia; mantener operativas las funciones independientes.

## 5. Política definitiva de precios

ACLARACIÓN CONFIRMADA: los precios de MEMOSOFT son precios de venta al público, no costos de adquisición. El propietario agrega costos del canal Mercado Libre. No denominarlos costo, ni deducir margen empresarial a partir de ellos.

Fórmula inicial vigente:

    Precio base público MEMOSOFT × 1,15 + cargo fijo aplicable al precio final.

El 15% es el recargo operativo actualmente acordado para afrontar costos del canal. No demuestra que cubra exactamente todos los cargos. Consultar cargos oficiales y mostrar diferencias sin modificar automáticamente esta fórmula.

Referencias históricas pendientes de validación:

| Precio final ARS | Cargo fijo de referencia ARS |
| --- | ---: |
| Menor a 15.000 | 1.330 |
| Desde 15.000 y menor a 24.000 | 2.740 |
| Desde 24.000 y menor a 33.000 | 3.320 |
| Desde 33.000 | 0 |

No habilitar escrituras basadas en esas referencias sin confirmar aplicabilidad y vigencia. Resolver los saltos de franja mediante cálculo determinístico probado. Usar precisión monetaria y redondeo explícito. Validar moneda, IVA incluido/excluido y presentación cuando la fuente no lo aclare; no inventarlos.

Separar dos vistas:

- Precio sugerido: resultado de la fórmula aprobada, con comparación contra el publicado.
- Cobertura de costos del canal: cobro estimado menos cargos conocidos de Mercado Libre, logística atribuible y publicidad cuando corresponda, comparado con el precio público de referencia sobre una base fiscal comparable.

La segunda vista no es ganancia neta. Si faltan costos, impuestos o comparabilidad, mostrar componentes conocidos y cálculo incompleto. La rentabilidad empresarial solo podrá incorporarse si se proporciona un costo real de adquisición y demás datos necesarios.

Detectar anomalías, cambios grandes, errores de unidad y antigüedad. Mostrar diferencias por lote; aprobación inicial obligatoria. Automatización posterior solo con política aprobada de variación, mínimos, fuentes y excepciones. No reducir precios por competencia ni alterar porcentajes sin autorización.

## 6. Expansión y calidad de publicaciones

Este frente avanza temprano en paralelo con la estabilización de fuentes; no depende de completar toda la inteligencia artificial.

Flujo: catálogo → vinculación → candidatos faltantes → familia/presentación → categoría/atributos → información técnica → precio → multimedia → contenido → validación → muestra → aprobación de lote → ejecución → lectura remota de confirmación.

Barras generalmente por unidad de 6 o 12 metros; chapas, mallas y metales desplegados por hoja. Validar excepciones. No inferir intercambiabilidad ni características estructurales por títulos parecidos.

Plantillas por familia: convenciones de títulos, descripción, atributos, imágenes, presentación y condiciones de entrega. El propietario aporta imágenes; se admiten genéricas representativas solo si son adecuadas y compatibles con políticas. Registrar faltantes de fotos específicas y video.

Validar el modelo real de User Products, familias y variantes antes de escribir. Preservar vínculos, historial y ofertas existentes. Preparar hasta 30 registros por lote inicialmente, con revisión de muestras y todas las excepciones, además de validación automática de cada registro.

Priorizar candidatos por datos completos, viabilidad logística, demanda observable y oportunidad comercial; explicar el orden. Distinguir listo, pendiente de información, bloqueado y descartado con motivo.

Después de publicar, comprobar estado remoto y revisar errores, calidad, visitas y ventas disponibles. Mantener simultáneamente catálogo existente y expansión.

## 7. Atención rápida y aprendizaje

Objetivo operativo: que las preguntas lleguen a una bandeja priorizada con contexto y una respuesta preparada, reduciendo el tiempo humano de búsqueda y redacción.

Distinguir preguntas públicas, mensajes posventa y reclamos. Conservar sus restricciones y plazos. Medir demora de detección, preparación, aprobación y envío por separado, incluyendo horario de atención. Configurar el objetivo de tiempo; no inventar una promesa de atención 24/7.

La IA clasifica y redacta con conocimiento verificado, mostrando fuentes y faltantes. No confirma stock, descuentos, plazos ni propiedades técnicas sin respaldo. Derivar reclamos, compatibilidades sensibles, faltantes y casos contradictorios.

Inicialmente todo envío requiere aprobación humana. Las FAQ aprobadas y otras respuestas rutinarias podrán automatizarse por políticas explícitas, después de evaluarse con casos reales; no basta aprobar unas cuantas respuestas para habilitar autonomía.

Registrar edición, motivo y ejemplo corregido. La memoria recupera ejemplos y propone reglas versionadas. No hay entrenamiento automático del modelo ni cambio autónomo de permisos. La confianza se fundamenta en validaciones y evaluación, no en un porcentaje autodeclarado por el modelo.

## 8. Pedidos y disponibilidad

No existe inventario físico confiable. La cantidad ofrecida, por ejemplo 100 unidades, es disponibilidad comercial configurable y no garantía de stock real.

Pedido detectado → registro único → confirmación humana de producto/presentación/cantidad → preparación → coordinación → entrega → seguimiento.

La interfaz permite confirmar disponibilidad o informar faltante, registra responsable y tiempo, y escala demoras. Hasta definir responsable y objetivo de respuesta, se usa una cola manual visible; no se presupone confirmación.

Ante faltante: identificar publicaciones vinculadas, proponer pausa o ejecutarla bajo política aprobada y verificar estado remoto. No reactivar sin confirmación. El pedido vendido permanece en revisión humana. No cancelar ni reembolsar automáticamente.

Mostrar reclamos, devoluciones, vencimientos y riesgos reputacionales según acceso real. Implementar seguimiento de MercadoLíder como objetivo, utilizando requisitos vigentes, sin prometer obtención.

## 9. Logística

Origen: San Antonio 1250, Barracas, CABA.

Acarreos confirmados: USD 20; USD 39,50; USD 79. Conversión a pesos con valor, fuente y fecha visibles. Tipo de cambio configurable; no seleccionar una cotización comercial silenciosamente.

Radios 8/16/25 km por recorrido vial son una propuesta pendiente de validación, no cobertura aprobada. Incorporar zonas, excepciones, longitud, peso y restricciones. Sin rutas verificadas, aceptar distancia confirmada manualmente y marcar cotización pendiente cuando corresponda.

Dentro de cobertura aplicable: más de 300 kg, sin cargo dentro de 72 horas; sin mínimo, sin cargo dentro de 10 días. Validar horarios, calendario y compatibilidad con compromisos de Mercado Libre antes de prometerlos automáticamente.

Fuera de cobertura: cliente coordina agencia; Perticari entrega sin cargo en sucursales de La Boca/Barracas. No prometer que una agencia acepta cualquier barra, peso o bulto. Transporte posterior y condiciones deben confirmarse con cliente/agencia.

## 10. Crecimiento y publicidad

Construir un embudo con los datos disponibles: exposición → visitas → ventas → resultado económico del canal. Diferenciar métricas orgánicas, publicitarias y de órdenes. Registrar ventanas temporales, atribución y cobertura.

Recomendaciones prioritarias: medidas faltantes; contenido y atributos incompletos; preguntas repetidas que revelan información ausente; publicaciones visitadas sin ventas; barreras de logística; candidatos a campañas; errores o precios desactualizados.

Cada recomendación incluye evidencia, hipótesis, acción, esfuerzo, riesgo, métrica y momento de revisión. No atribuir causalidad a una comparación antes/después sin considerar volumen, estacionalidad y cambios concurrentes.

Publicidad: comenzar por diagnóstico y propuesta de pilotos sobre publicaciones completas, con precio vigente y disponibilidad/logística atendibles. Presupuesto, duración, tope, objetivos y criterios de pausa requieren aprobación explícita. No inventar presupuesto ni umbral de ROAS.

Verificar recursos actuales y permisos de Product Ads. Si solo hay lectura, producir propuestas aplicables manualmente. Medir gasto, ventas atribuidas, ACOS/ROAS y cobertura de costos cuando los datos permitan calcularlos. No presentar ROAS como rentabilidad empresarial.

El sistema puede sugerir cambios y experimentos; gastos y ampliaciones de presupuesto siguen sujetos a autorización.

## 11. IA, automatización e infraestructura

Arquitectura modular sobre la V1: fuentes → conocimiento validado → reglas/IA → propuestas → permisos → ejecución → reconciliación → evaluación.

Proveedor y modelo configurables. Salidas estructuradas, validación, límites de costo y recuperación ante fallos. Usar reglas para cálculos y tareas determinísticas; IA para lenguaje, interpretación y recomendaciones que justifiquen su uso. Minimizar datos personales enviados.

Textos externos son datos no confiables y nunca instrucciones de permisos. La IA no accede libremente a escrituras, secretos ni consultas arbitrarias.

Autonomía por tipo de tarea: observación; recomendación; ejecución dentro de política; operación rutinaria con excepciones. Promoción siempre aprobada y evaluada; retroceso ante anomalías. Controles para pausar IA, trabajos y escrituras independientemente.

Cada acción tiene identidad, versión de datos/política, parámetros, justificación, aprobador, estado y resultado remoto. Aprobaciones caducan si cambian datos sensibles. Idempotencia; resultado incierto exige reconciliar antes de reintentar. Cambios externos no siempre son reversibles: documentar compensaciones y límites.

Procesamiento continuo por eventos y tareas programadas, sin depender de abrir el panel. Webhooks persisten y responden rápido; trabajo pesado asincrónico. Reintentos limitados, cola de fallos y reconciliación. Ajustar frecuencias a cuotas y prioridades.

Conservar Workers/D1; evaluar Queues, R2 u otros servicios solo por necesidad y costo. Separar desarrollo, pruebas y producción. MFA, permisos de mínimo alcance, auditoría sin secretos, retención de datos personales, respaldo y prueba de restauración.

Presupuestos de infraestructura e IA configurables, con alertas y límites. Sin aprobación de gasto no contratar ni activar servicios pagos. Al alcanzar límite de IA, continuar funciones esenciales y reglas disponibles, mostrando qué recomendaciones quedan pendientes.

## 12. Entregas y criterios de salida

### A. Base conectada y verificable

Auditoría de V1; sincronización real de lecturas; MEMOSOFT o importación de respaldo; diagnóstico de permisos/User Products; procedencia y frescura; trabajos y errores visibles.

Salida: importación repetible sin duplicados; vínculos preservados; fallo de fuente visible; pruebas existentes pasan; documentación distingue real y simulado. Integraciones bloqueadas no detienen funciones independientes.

### B. Expansión y atención asistida, en paralelo

Familias prioritarias, candidatos y plantillas; validación de borradores/lotes; precios coherentes; bandeja de consultas y conocimiento; feedback; pedidos y disponibilidad.

Salida: muestra completa revisable de una familia; todos los registros del lote validados; respuestas respaldadas; ninguna escritura no autorizada. Piloto comercial posterior con autorización específica y confirmación remota.

### C. Optimización comercial y piloto publicitario

Métricas y línea base; oportunidades explicadas; calidad; campañas y experimentos; logística confirmada; tiempos de respuesta y excepciones.

Salida: cada propuesta tiene evidencia y revisión prevista; se distingue gasto real, ventas atribuidas y estimaciones; presupuesto no se modifica sin aprobación. Si una API no permite operar, la alternativa manual queda explícita.

### D. Operación continua y autonomía controlada

Políticas de actualización, respuestas rutinarias y pausas por faltante; evaluación de errores; alertas; respaldo/restauración; monitoreo de reputación.

Salida: cada automatismo puede detenerse, tiene límites, registra resultados y deriva excepciones. Se prueba recuperación ante fallos e incertidumbre de escritura. No se aumenta autonomía automáticamente.

### E. Extensiones posteriores

PWA y notificaciones; asistente interno por WhatsApp; atención en WhatsApp oficial. Son evolución prevista, no bloquean el producto inicial. Revisar consentimiento, costos y políticas; no trasladar indebidamente atención de Mercado Libre.

## 13. Evaluación de resultados

Medir línea base desde datos reales disponibles y conservar su período. Revisar a 30, 60 y 90 días de operación real, además del control semanal.

- Oferta: publicaciones activas, productos/presentaciones cubiertos, candidatos válidos, bloqueos y calidad por familia.
- Atención: preguntas recibidas, mediana y percentil 90 del tiempo de respuesta, demoras por etapa, correcciones y pendientes.
- Operación: tiempo humano estimado mediante registro o muestreo, errores, datos caducados, pedidos pendientes y excepciones.
- Comercial: visitas cuando disponibles, órdenes, unidades, facturación, cancelaciones y conversión con definición explícita.
- Publicidad: gasto, atribución, resultados y costos de canal conocidos; sin margen neto inventado.
- Automatización: tareas resueltas, confirmación remota, errores, intervenciones y costo de IA/infraestructura.

No fijar mejoras porcentuales sin línea base ni prometer cuadruplicar ventas. Evaluar si la oferta adicional recibe demanda y ajustar la estrategia por familia.

## 14. Datos pendientes y cuándo son necesarios

No se necesita más información del propietario para cerrar esta especificación. Estos valores quedan explícitamente pendientes y configurables:

| Dato | Necesario antes de |
| --- | --- |
| Tarifas oficiales aplicables, presentación, moneda e IVA del precio fuente | Actualizar precios productivos |
| Modelo vigente y permisos de ML | Escritura del tipo correspondiente |
| Fotos representativas y atributos requeridos | Publicar la familia afectada |
| Responsable de disponibilidad y horario/objetivo de atención | Automatizar escalaciones y compromisos |
| Cobertura, cotización USD/ARS y condiciones logísticas | Cotizaciones confirmadas automáticas |
| Proveedor/credencial de IA y presupuesto | Consumir IA paga |
| Presupuesto, objetivo y autorización publicitaria | Activar o modificar campañas |
| Costos de adquisición reales | Mostrar rentabilidad empresarial, opcional y fuera de la fórmula vigente |

Investigar lo que pueda obtenerse de fuentes oficiales; pedir solo decisiones comerciales que no puedan inferirse. No solicitar secretos por chat. Un bloqueo afecta a su operación dependiente, no a toda la implementación.

## 15. Regla de entrega

Cada etapa termina con código funcional y pruebas proporcionales, estado de integraciones, limitaciones, costos nuevos, procedimiento de recuperación y siguiente prioridad. Mantener migraciones compatibles y reutilizar la V1.

Este alcance queda definido para desarrollar tras la indicación del propietario. La oportunidad comercial se convierte en experimentos y mejoras comprobables; el sistema debe ahorrar trabajo y ampliar oferta útil, preservando la calidad de atención y la operación real.
