# Perticari Command Center

Centro de trabajo privado para expandir y operar el canal de Mercado Libre de Perticari & Cía. Reúne catálogo, publicaciones, precios, preguntas, pedidos, entregas y oportunidades de crecimiento.

**[Abrir el Command Center](https://perticari-notificaiones.perticari-sa.workers.dev/app)** · [Administrar la conexión con Mercado Libre](https://perticari-notificaiones.perticari-sa.workers.dev/connect)

La URL usa el nombre original del Worker, `perticari-notificaiones`. La V2 está preparada en este repositorio; lo que se ve en esa dirección depende de la última versión desplegada en Cloudflare. [Actualizar y comprobar la V2](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/PROBAR_V2.md).

## Qué hace hoy

- Cruza productos y publicaciones existentes; identifica códigos y medidas por evaluar para ampliar la oferta.
- Importa archivos con vista previa y prepara publicaciones por familias y lotes de hasta 30.
- Calcula propuestas desde el **precio de venta al público de MEMOSOFT**, el recargo acordado y los cargos configurados. Muestra cambios e historial.
- Consulta preguntas, contrasta las pendientes antiguas con Mercado Libre y prepara respuestas para revisión humana.
- Organiza pedidos, confirmación de disponibilidad, excepciones y alternativas de entrega.
- Registra conocimiento validado, correcciones, oportunidades y experimentos comerciales. La IA es opcional y tiene límites de gasto.

Las escrituras comerciales requieren aprobación y validación del contrato aplicable de Mercado Libre. La documentación distingue qué se probó localmente y qué falta verificar con la cuenta: [estado de integraciones](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/INTEGRATIONS.md), [pruebas](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/TESTING.md) y [hoja de ruta](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/ROADMAP.md).

## Desarrollo

El código de la aplicación está en [`Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/`](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/). Se requiere Node 24.

```sh
npm run setup
npm test
npm run dev
```

`npm test` compila antes de ejecutar las pruebas. Para probar la interfaz en Chromium: `npm run test:browser`. El entorno local usa datos sintéticos; los archivos comerciales y las claves no se guardan en Git.

La [especificación del producto](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/VERSION_OFICIAL_DEFINITIVA.md) conserva los objetivos completos. `specs/` y el ZIP original documentan la base histórica.

La [propuesta de V3](Perticari_Command_Center_Repo_Starter_v0.1/perticari-command-center/docs/V3_RELEVAMIENTO.md) reúne el diagnóstico de las pruebas del propietario, los requisitos agrupados y los criterios de aceptación. Es un documento para definir la próxima entrega; no indica que esas funciones ya estén implementadas.
