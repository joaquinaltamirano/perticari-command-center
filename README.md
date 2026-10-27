# Perticari Command Center

Centro de trabajo privado para expandir y operar el canal de Mercado Libre de Perticari & Cía. Reúne catálogo, publicaciones, precios, preguntas, pedidos, entregas y oportunidades de crecimiento.

**[Abrir el Command Center](https://perticari-notificaiones.perticari-sa.workers.dev/app)** · [Administrar la conexión con Mercado Libre](https://perticari-notificaiones.perticari-sa.workers.dev/connect)

La URL usa el nombre original del Worker, `perticari-notificaiones`. La V3 está preparada en este repositorio; lo que se ve en esa dirección depende de la última versión desplegada en Cloudflare. [Instalar y probar V3](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/PROBAR_V3.md).

## Instalar V3

Descargar [el ZIP de actualización](releases/v3/Perticari_V3_actualizacion.zip) o [el Worker por separado](releases/v3/Worker_Perticari_V3.js). La [guía breve](releases/v3/LEEME.md) explica cómo reemplazar el código en el Worker existente, conservar D1/claves y comprobar el cron. Este repositorio no realiza un despliegue automático sobre la cuenta del propietario.

## Qué hace hoy

- Cruza productos y publicaciones existentes; identifica códigos y medidas por evaluar para ampliar la oferta.
- Importa archivos con vista previa y prepara publicaciones por familias y lotes de hasta 30; permite archivar, restaurar, descartar y eliminar borradores compatibles, además de administrar grupos de lotes.
- Audita publicaciones existentes y consulta categorías con nombres, descripciones, imágenes y atributos; prepara reemplazos con vista previa y reconciliación.
- Guarda plantillas por subfamilia, propone imágenes compatibles de la cuenta e importa ZIP con asignaciones por SKU. Aloja las imágenes aprobadas en una biblioteca inicial limitada.
- Completa la lectura MEMOSOFT en una versión provisional antes de promover sus precios; la consulta programada es cada cuatro horas cuando está habilitada.
- Calcula propuestas desde el **precio de venta al público de MEMOSOFT**, el recargo acordado y los cargos configurados. Muestra cambios e historial.
- Consulta preguntas y las contrasta por ID, importa historial respondido y prepara referencias revisables; permite consultas técnicas acotadas a fuentes habilitadas.
- Organiza pedidos, confirmación de disponibilidad, excepciones y alternativas de entrega.
- Registra conocimiento validado, correcciones, oportunidades e informes publicitarios con procedencia. La IA es opcional y tiene límites de gasto.
- Ofrece zonas dibujables, búsqueda de direcciones, recorrido orientativo y cotizaciones ARS con importe aceptado estable; adaptador BNA con conservación ante fallos.
- Incluye mantenimiento de precios con política apagada por defecto, avisos, FAQ fijas aprobadas y notificaciones Web Push cifradas en navegadores compatibles.

La [matriz de estado V3](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/ESTADO_V3.md) identifica pendientes: acceso real MEMOSOFT/BNA desde Cloudflare, contratos modernos de ML, Product Ads remoto y cobertura aprobada. Las escrituras comerciales requieren aprobación y validación del contrato aplicable de Mercado Libre. La documentación distingue qué se probó localmente y qué falta verificar con la cuenta: [estado de integraciones](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/INTEGRATIONS.md), [pruebas](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/TESTING.md) y [hoja de ruta](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/ROADMAP.md).

## Desarrollo

El código de la aplicación está en [`Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/`](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/). Se requiere Node 24.

```sh
npm run setup
npm test
npm run dev
```

`npm test` compila antes de ejecutar las pruebas. Para probar la interfaz en Chromium: `npm run test:browser`. El entorno local usa datos sintéticos; los archivos comerciales y las claves no se guardan en Git.

La [especificación del producto](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/VERSION_OFICIAL_DEFINITIVA.md) conserva los objetivos completos. `specs/` y el ZIP original documentan la base histórica.

La [especificación V3 para aprobación](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/V3_ESPECIFICACION_PARA_APROBAR.md) define las tres etapas: mudanza masiva; mejora, mantenimiento y aprendizaje; herramienta principal con automatización y avisos. Incluye familias, reglas propuestas y criterios de aceptación. La acompañan el [diagnóstico de V2](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/V3_RELEVAMIENTO.md) y la [plantilla de descripciones](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/PLANTILLA_DESCRIPCIONES_ML.md). La implementación entregada y sus límites se registran en [ENTREGA_V3.md](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/ENTREGA_V3.md). La especificación conserva los objetivos y no sustituye la evidencia de validación.
