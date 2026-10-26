# Perticari Command Center · V2 · operación asistida

Panel privado para expandir el catálogo de Mercado Libre y gestionar propuestas, precios, preguntas y entregas. Implementación modular sobre el Worker y D1 que el usuario ya creó. Interfaz React adaptable a escritorio y móvil.

Estado: implementación y pruebas locales completadas; despliegue y smoke test de la API real pendientes. No se ejecutaron escrituras en la cuenta real. [Guía para actualizar](docs/PROBAR_V2.md).

## Desarrollo

Node24. Desde esta carpeta:

```sh
npm ci
npm run build
npm test
```

`npm run dev` usa Wrangler local. Configurar `.dev.vars` a partir del ejemplo con valores sintéticos y PCC_ORIGIN correspondiente a una URL HTTPS de prueba; las cookies requieren HTTPS. No usar secretos de producción en desarrollo. Para un navegador local, ejecutar `npx wrangler dev --local --local-protocol https` con `PCC_ORIGIN=https://localhost:8787`; aceptar el certificado local solo en ese entorno.

Prueba de navegador con Chromium instalado:

```sh
npm run test:browser
```

En Linux busca `/usr/bin/chromium`; se puede definir PCC_CHROMIUM_PATH. Requiere openssl para certificado del servidor local de prueba. Playwright está fijado como dependencia de desarrollo. No usa red de Mercado Libre; fetchMock prohíbe conexiones externas. El harness utiliza HTTPS local y dos factores reales con credenciales sintéticas.

Variables opcionales de pruebas: PCC_PRIVATE_SNAPSHOT para verificar un paquete privado local sin incorporarlo al bundle; PCC_CAPTURE_DIR para capturas fuera del repo. Los tests de CI no necesitan ese archivo ni lo incluyen.

## Novedades V2

Reconciliación de preguntas antiguas, refresco ligero, pedidos/disponibilidad, conocimiento validado, correcciones, IA opcional con presupuesto, oportunidades, experimentos, historial de precios, simulación de costos y controles de automatización. Ver [entrega V2](docs/ENTREGA_V2.md), [validación](docs/TESTING.md) y [dependencias pendientes](docs/ROADMAP.md).

## Qué contiene

- Catálogo y conciliación exacta SKU→varias publicaciones/variaciones, filtros, revisión e importación XLSX/JSON con preview, confirmación e idempotencia.
- Borradores por lote, plantillas por familia, contenido pendiente, edición con versión y preflight.
- Precios en centavos enteros/BigInt:15% + cargos por banda final, revisión de origen/unidad y exportación CSV. No es cálculo de margen neto ni autopricing.
- Atención: preguntas, sugerencias con reglas y evidencia, edición, aprobación y ejecución bajo flags.
- Logística: acarreo USD20/39,50/79, límites propuestos editables, cotización identificada, modalidades gratuitas condicionadas y agencia.
- Resultados basados en datos disponibles de operaciones/unidades/ventas brutas, sin métricas inventadas.
- Jobs persistentes, backoff de lecturas, comprobación de vendedor, auditoría, MFA TOTP, CSRF y OAuth cifrado.

Se reutiliza el OAuth previo con el mismo callback, secreto, derivación de cifrado y tablas. `wrangler.json` conserva las variables del dashboard (`keep_vars`) y el binding existente. No contiene valores secretos.

## Datos privados

No están versionados. El conversor `scripts/prepare-data.py` crea un paquete de importación desde los archivos que entregó el usuario:

```sh
python -m pip install -r scripts/requirements.txt
python scripts/prepare-data.py --master nombre.xls --prices catalogo_memosoft.xlsx --technical Fichas_tecnicas.xlsx --out /ruta/privada/Catalogo_inicial_Perticari.json
```

El conversor no publica, no scrapea y no usa precios d6pre*. El paquete se importa desde el panel y conserva hashes de las fuentes. La fecha comercial de los precios no se deduce de la fecha del archivo.

## Arquitectura, fuentes y límites

- [Decisiones de la V1](docs/ADR_V1.md): reemplazo de la propuesta Next/Postgres, reglas confirmadas y seguridad.
- [Integraciones V2 y evidencia](docs/INTEGRATIONS.md): contratos ML pendientes2026, MEMOSOFT en vivo aún no certificado, métricas y alertas disponibles.
- [Guía de actualización y prueba](docs/PROBAR_V2.md): publicación manual en el Worker existente, importación privada y piloto.
- [Entrega y validación](docs/ENTREGA_V1.md).
- `specs/`: ocho documentos originales, conservados como base histórica. La conversación del usuario y ADR_V1 actualizan las decisiones posteriores.

## Despliegue por CLI

Alternativa al editor, desde un equipo del dueño con Cloudflare autorizado:

```sh
npm run build
npx wrangler login
npx wrangler deploy --keep-vars
```

No se ejecutó en esta tarea. Las tablas se inicializan de forma aditiva al primer acceso autenticado. No borrar la base ni cambiar el nombre/binding. Para producción hacen falta pruebas reales de lectura, contrato ML vigente antes de escrituras, validación de extracción MEMOSOFT y completar la operación de backups/alertas.
