# V3: diagnóstico, requisitos y criterios de aceptación

Fecha: 26 de octubre de 2026. Estado: propuesta para la charla técnica; no constituye una entrega V3 ni habilita cambios comerciales.

Complementa [la especificación del producto](VERSION_OFICIAL_DEFINITIVA.md). Conserva el objetivo de ampliar la oferta y operar el canal con menos trabajo manual. Este relevamiento agrupa los nueve puntos del propietario, incorpora sus capturas de producción y distingue problemas observados de funciones propuestas. No se modificó ni desplegó código de aplicación durante este relevamiento.

## 1. Diagnóstico de la V2

| Tema | Evidencia | Conclusión y alcance |
| --- | --- | --- |
| MEMOSOFT | La captura muestra el enlace invitado `/dist/php/login.php?eventual`; el panel informa «El enlace invitado requiere revisión». `observedGuestAction` exige que ese enlace contenga `invitado`, `guest` o `catalogo`. | Hay un rechazo concreto en nuestro lector antes de recorrer el catálogo. Corregirlo es necesario; aún habrá que comprobar sesión, redirecciones, columnas y paginación reales. |
| Scripts anteriores | `Actualizador de precios (Perticari).py` hace clic en `#usuario-invitado` mediante Selenium y recorre 111 páginas; `scraping_memosoft.py` prueba cuatro. | Sirven como referencia del acceso y de las filas. La captura actual muestra 112 páginas: el total debe descubrirse, no copiarse del script. Los recargos antiguos del 11/13% no reemplazan la regla actual del 15%. |
| Actualización MEMOSOFT | `defaultPolicy.auto_memosoft` es `false`; si se habilita, `schedule` programa una lectura por día. | No existe actualización continua. El cron de un minuto del proyecto no significa que todas las fuentes se consulten cada minuto; su activación efectiva en Cloudflare debe comprobarse. |
| Preguntas pendientes | La búsqueda guarda `checked_at` del ciclo. La reconciliación individual selecciona solo preguntas con `checked_at` anterior al ciclo. | Las preguntas recién devueltas por la búsqueda pueden quedar fuera de esa segunda comprobación. El estado «reconciliación actualizada» no prueba que cada pendiente se consultó individualmente. |
| Cuatro pendientes de la captura | Hay preguntas antiguas, una verificación reciente y textos parecidos. No se dispone de la respuesta autenticada actual por cada ID. | No está demostrado que estén respondidas ni que sean duplicados. Debe contrastarse el estado remoto por ID; ni antigüedad ni ausencia en una búsqueda equivalen a respuesta. |
| Ventas y evento | El panel muestra 403 en ventas recientes, historial y un evento; preguntas y publicaciones tienen consultas exitosas. | Investigar permisos, recurso solicitado, aplicación/cuenta y causa remota. No alcanza para atribuirlo a una desconexión general ni para asegurar que reautorizar lo resolverá. |
| Publicidad | El código registra experimentos manuales; no consulta Product Ads. | Falta la integración real de publicidad. |
| Entregas | Existe cotizador con distancia y cambio introducidos manualmente. | Faltan geocodificación, rutas y fuente automática de cambio. |

Referencias de código: [lector MEMOSOFT](../src/server/memosoft.mjs), [trabajos y reconciliación](../src/server/jobs.mjs), [políticas iniciales](../src/server/db.mjs), [cliente ML](../src/server/mercadolibre.mjs).

La revisión se hizo sobre el código, los scripts aportados y las capturas del propietario. Los intentos de acceso desde este entorno a MEMOSOFT y a la documentación oficial de ML devolvieron 403; no se consultaron datos privados de la cuenta ni se certificaron contratos nuevos de la API. Las capturas sí aportan evidencia de uso real de V2, posterior a la documentación original de entrega.

## 2. Catálogo, precios y actualización de fuentes — puntos 1 y 6

**Requisito:** obtener el catálogo completo de MEMOSOFT mediante el acceso invitado, conservar precios de venta al público y detectar cambios que afecten a las publicaciones vinculadas.

- Admitir el enlace invitado observado manteniendo las restricciones de dominio, tenant y lectura; conservar la sesión y recorrer todas las páginas descubiertas.
- Mostrar progreso, productos válidos, errores, inicio/fin, última lectura completa y antigüedad de cada precio. Separar una lectura parcial de una sincronización completa.
- Conservar el último precio válido si una página falla. Un precio vacío o mal formado nunca se convierte en cero ni prueba una baja del producto.
- Comparar versiones por SKU/presentación. Ante cambios, crear avisos persistentes con precio anterior, nuevo, porcentaje, fuente y publicaciones afectadas; evitar avisos repetidos para el mismo cambio.
- Mantener **precio público MEMOSOFT × 1,15 + cargo fijo aplicable**, con tramos y cargos vigentes verificados. Comparar además lo que quedaría después de cargos reales con el precio público de referencia. Esto mide cobertura de costos del canal, no margen neto del negocio.
- Conservar Excel como respaldo y vía de importación, sin obligar al operador a generar una planilla en cada actualización.
- Averiguar si MEMOSOFT ofrece una exportación o interfaz autorizada y estable. Si existe, evaluarla como fuente preferente frente al scraping; no se da por disponible.

**Propuesta de programación:** un coordinador común con frecuencias distintas, reintentos, límites y botón «Actualizar ahora». Preguntas por notificaciones y consulta aproximadamente cada minuto; MEMOSOFT cada cuatro horas inicialmente, sujeto a medir duración/carga de una lectura completa; cambio cada 30–60 minutos; publicaciones por eventos y conciliación diaria. Mostrar última consulta, último éxito y próxima ejecución. No iniciar otra lectura del catálogo mientras siga activa la anterior.

La frecuencia no garantiza detección instantánea: el aviso aparece después de una lectura exitosa. Las tareas deben seguir funcionando con la aplicación cerrada y sin que un catálogo largo demore la atención.

**Dólar:** falta identificar qué indicador consulta el propietario en Google. «1 USD a ARS», oficial, MEP o blue no son referencias intercambiables. Usar una fuente estable para el indicador elegido, con valor, fecha, procedencia y estado de vigencia. Evitar depender del HTML de una búsqueda de Google. Mantener corrección manual identificada cuando la fuente falle.

**Aceptación:** lectura completa contrastada contra muestras del catálogo real; cambios detectados y asociados a las publicaciones correctas; un fallo intermedio queda visible sin precios en cero ni estado global engañoso; ejecución programada comprobada con la interfaz cerrada.

## 3. Catálogo comercial y publicaciones unificadas — puntos 2, 3 y 7

**Requisito:** gestionar publicaciones existentes y futuras desde el mismo catálogo, filtrando las familias que Perticari elija y conservando sus vínculos e historial.

- Lista de familias incluidas, excluidas y pendientes. La exclusión comercial no borra los datos originales.
- Vinculación entre SKU, presentación, variante/producto y publicación de ML; detección de coincidencias dudosas y duplicados antes de crear nada.
- Categorías visibles con nombre y ruta; identificadores de ML gestionados internamente. Verificar atributos y modelo de variantes/User Products admitido en cada categoría.
- Plantillas persistentes por familia para título, descripción y atributos. Incluir datos comerciales confirmados, medidas y presentación; no afirmar propiedades técnicas ausentes.
- Biblioteca de imágenes por familia/SKU, vista previa y tareas para completar imágenes o video. Las imágenes genéricas deben representar al producto y cumplir las reglas de ML; no habilitan datos visuales engañosos.
- Importador ZIP **del Command Center** con imágenes y una correspondencia explícita de familia/SKU/orden. Validar archivos y destinos antes de subirlos. No se presupone que ML acepte ese ZIP directamente.
- Si se reciben diseños editables, definir formato y variables antes de prometer generación automática. Un ZIP de imágenes terminadas y un motor que renderiza diseños editables son capacidades distintas.
- Vista previa de cambios y ejecución por lotes con resultados individuales, reintento seguro y auditoría. Preservar publicaciones existentes y sus vínculos cuando el cambio sea compatible; las restricciones de ML deben explicarse antes de ejecutar.

**Pasaje previsto:** importar/leer → elegir familias → vincular publicaciones → completar excepciones → previsualizar → aprobar lote → ejecutar por API → comprobar resultados. La carga fila por fila no debe recaer en el propietario. Excel queda como entrada o alternativa de intercambio; la exportación actual del sistema no debe presentarse como una plantilla oficial de carga masiva de ML si no coincide con ella.

**Aceptación:** una familia piloto con productos ya publicados y faltantes, sin duplicaciones, con todas sus medidas válidas y resultados remotos comprobados. Después ampliar los lotes. Medir oferta comercial cubierta, no solo cantidad bruta de publicaciones.

## 4. Atención con historial y conocimiento validado — punto 4

**Requisito:** una bandeja que refleje el estado real de ML, permita responder y prepare recomendaciones fundadas en el conocimiento de Perticari.

- Reconciliar periódicamente cada pendiente por ID, con fechas diferenciadas de búsqueda y verificación individual. Comprobar también el estado inmediatamente antes de enviar una respuesta.
- Mostrar preguntas nuevas sin recarga manual; actualizar las respondidas desde ML o desde el Command Center. Conservar históricos sin dejarlos en pendientes.
- Importar preguntas y respuestas históricas con la ventana/paginación que efectivamente permita la API. Los 60 días visibles en la web no garantizan por sí solos idéntica cobertura por API; ofrecer importación de archivo como alternativa.
- Agrupar ejemplos por intención y familia: medidas, material, uso, disponibilidad, entrega, retiro, facturación. Evitar convertir tarifas, disponibilidad o condiciones antiguas en reglas actuales.
- Permitir «Validar como referencia», corregir, descartar y retirar una referencia. Registrar que una respuesta fue enviada no equivale a aprobarla automáticamente como regla reutilizable.
- Conservar correcciones y proponer mejoras de conocimiento para revisión. La primera implementación usa recuperación de ejemplos y reglas aprobadas; no requiere reentrenar un modelo cada vez.
- Investigar consultas técnicas mediante fuentes acotadas: fichas del fabricante, documentación técnica confiable y fuentes aprobadas. Mostrar procedencia y fecha; guardar como conocimiento solo tras validación.
- No inferir aptitud estructural, resistencia, stock o plazos a partir de información incompleta. Ante incertidumbre, preparar una respuesta que pida el dato necesario o derive a revisión técnica.

**Aceptación:** contrastar las cuatro pendientes reportadas contra ML; una respuesta hecha fuera del panel desaparece de pendientes dentro del plazo de actualización acordado; una respuesta enviada desde el panel queda confirmada remotamente; evaluar sugerencias contra un conjunto de preguntas históricas validado por Perticari. Un fallo de IA o de búsqueda permite continuar la atención manual.

## 5. Entregas y cotización — puntos 2 y 9

**Requisito interno:** ingresar dirección o código postal, resolver la ubicación y proponer un acarreo en pesos desde San Antonio 1250, Barracas, con distancia, tarifa, cambio y condiciones visibles.

- Tarifas confirmadas: USD 20, USD 39,50 y USD 79. Las zonas/radios siguen pendientes; 8/16/25 km viales eran propuestas, no cobertura aprobada.
- Elegir proveedor de geocodificación/rutas tras revisar cobertura, cuotas y costos. No asumir que un mapa visible incluye geocodificación o cálculo vial gratuito.
- Diferenciar distancia por calles de radio en línea recta. Un código postal da una estimación; una dirección ambigua o una entrega en el límite requiere precisión antes de confirmar.
- Admitir zonas y excepciones por longitud, peso, vehículo y recorrido. Guardar la cotización con su vigencia y los datos usados para calcularla.
- Aplicar entregas sin cargo de más de 300 kg dentro de 72 horas y sin mínimo dentro de diez días únicamente en cobertura confirmada y cuando las condiciones de la venta permitan esos plazos.
- Fuera de cobertura: contemplar agencia elegida por el cliente y entrega sin cargo en sucursales de La Boca/Barracas, con aceptación del material por el transportista y costo del tramo posterior a confirmar. No prometer que cualquier agencia transporta barras de 6/12 m.

**Requisito en la publicación de ML:** verificar modalidades habilitadas por cuenta, categoría y dimensiones, y cómo admiten costos/zonas de envío. El cotizador propio no se puede dar por insertable dentro de la ficha ni por integrado al checkout. Mostrar al comprador un precio nativo por código postal depende de capacidades de ML; documentar el resultado de la comprobación antes de comprometer esa función. La alternativa debe usar condiciones y canales permitidos por ML.

**Aceptación:** validar direcciones de cada zona, bordes y destinos externos; cotejar importes y condiciones con Perticari. Probar separadamente qué ve el comprador en ML y qué puede calcular el operador en el panel.

## 6. Publicidad y crecimiento medible — punto 8 y aportes comerciales

**Requisito:** incorporar publicidad real y sus resultados al centro de trabajo, distinguiendo datos consultados, propuestas y acciones ejecutadas.

- Verificar elegibilidad, permisos y contrato vigente de Product Ads. Mostrar un diagnóstico concreto si la cuenta no ofrece acceso.
- Importar campañas y métricas disponibles: inversión, impresiones, clics, ventas atribuidas y relación gasto/ventas, con rango temporal y criterio de atribución. No atribuir toda venta a publicidad ni llamar rentabilidad a ROAS.
- Vincular campañas y publicaciones para detectar productos con tráfico que no convierten, inversión sin resultados y oportunidades de escala.
- Proponer campañas/presupuestos sobre productos con ficha, precio, disponibilidad comercial y entrega verificables. La creación o modificación por API queda sujeta a capacidad comprobada y presupuesto aprobado.
- Si una acción solo está disponible en el panel de ML, mostrarlo explícitamente; un registro manual de experimentos no sustituye una integración publicitaria.

**Estrategia propuesta:** priorizar familias por faltantes reales de medidas, demanda observada y posibilidad de entregar; completar fichas y reducir incertidumbre de compra; acelerar respuestas; experimentar con publicidad de forma medible. No esperar a completar todo el catálogo para hacer un piloto comercial con una familia lista.

Separar señales: pocas visitas → investigar descubrimiento, títulos, categoría y publicidad; visitas sin ventas → investigar precio, presentación, confianza y entrega; muchas consultas repetidas → completar la ficha. El número diario de preguntas, por sí solo, no demuestra baja visibilidad. Ampliar cuatro veces la oferta no garantiza multiplicar ventas por cuatro.

**Aceptación:** al menos una campaña elegible con datos reales conciliados contra ML, o evidencia precisa del impedimento de acceso. Para declarar el módulo integrado, debe haber una conexión funcional; el impedimento permanece abierto hasta resolverlo o acordar expresamente otra vía.

## 7. Solidez operativa y uso oficial — punto 5 y requisito transversal

- Errores accionables por fuente: operación/recurso, código remoto, causa sanitizada, último éxito y siguiente acción. No mostrar tokens ni datos de clientes en diagnósticos públicos.
- Diferenciar sincronización completa, parcial, vencida y fallida. Una ejecución de trabajo exitosa no equivale a haber verificado toda la fuente.
- Prioridad a atención y ventas, sin bloquearlas detrás del catálogo. Reintentos limitados; control de tareas duplicadas y escrituras de resultado incierto.
- Pruebas automáticas de regresión y pruebas reales supervisadas por flujo: catálogo, precios, respuesta, actualización/publicación, cotización y métricas.
- Copia de seguridad y restauración comprobada antes de escrituras masivas; registro de versión desplegada y procedimiento de reversión. La reversión de código no deshace automáticamente acciones ya realizadas en ML.
- GitHub con código, README, cambios y evidencia de validación por entrega. Conservar fuera del repositorio secretos, exportaciones comerciales y datos personales.
- Mantener la misma dirección de prueba del Command Center, salvo necesidad técnica explicada. No es necesario contratar un dominio para cerrar estos requisitos.

## 8. Orden de implementación y datos pendientes

1. Resolver fuentes y diagnóstico: MEMOSOFT completo, preguntas contrastadas y acceso a ventas; verificar cron real.
2. Completar el flujo de una familia: selección, vínculos, categorías con nombre, plantilla, precios y actualización/publicación piloto.
3. Integrar historial validado de atención y cotización de entregas, con fuentes y cobertura confirmadas.
4. Incorporar métricas y piloto de publicidad en paralelo a la expansión de familias ya verificadas.
5. Prueba integral operativa, restauración, documentación y validación del propietario antes de declarar V3 lista para uso oficial.

Datos de negocio que debe definir Perticari, sin repetir lo ya aportado:

- Familias a incluir/excluir y primera familia prioritaria.
- Búsqueda/indicador exacto del dólar que usa en Google; criterio de cobertura de los tres acarreos y sus excepciones.
- Texto comercial común, información específica por familia y archivos de imágenes/templates cuando estén preparados. Se puede empezar con borradores marcados y ejemplos representativos.
- Presupuesto de publicidad y límites para proveedores pagos de IA/mapas al activar esas integraciones. No se presupone autorización para gastar.

Los scripts, catálogos, origen de reparto y tres tarifas ya fueron aportados. No hace falta solicitar nuevamente contraseñas ni secretos de ML. Primero se prepara el diagnóstico de permisos; cualquier acción necesaria en la cuenta debe explicarse con el campo o paso exacto.
