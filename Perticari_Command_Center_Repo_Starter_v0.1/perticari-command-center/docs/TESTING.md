# Validación V2

Entorno: Node 24, React, Miniflare/Workers, D1 local y Chromium. Las pruebas usan credenciales sintéticas y bloquean conexiones externas. Los archivos privados se usan únicamente en el ensayo local indicado, fuera de Git y del bundle.

## Comandos

```sh
npm ci
npm test
npm run test:browser
XDG_CONFIG_HOME=/workspace/.cache/config WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run
```

`npm test` y `test:browser` compilan antes de probar: se corrigió la posibilidad de validar un dist antiguo.

## Resultado

90 pruebas unitarias/de integración: 90 aprobadas, 0 fallidas/omitidas. Incluyen las 64 pruebas existentes y regresiones nuevas de sincronización, fechas, búsquedas sin resultados, 403/404, concurrencia de estados, disponibilidad de pedidos, conocimiento, correcciones, presupuesto/citas de IA, precios, MEMOSOFT observado, pausa y reconciliación sin reenvío. Cron verificado para que atención y ventas no dejen permanentemente pendiente el catálogo.

Navegador: Chromium, escritorio 1440×1080 y móvil 390×844; login y MFA, importación con vista previa, catálogo, lote 30, plantilla, precio editable, cálculo de entrega, configuración, pedidos, conocimiento validado, respuesta fundamentada, feedback, cierre de pregunta desde estado externo y experimentos. Se comprueba que la consulta periódica actualice la bandeja sin recargar la página. Se repite con el paquete privado: 1.256 productos/200 publicaciones. Sin errores JavaScript.

Dry run: bundle aproximadamente 567 KiB / 163 KiB gzip, binding existente conservado. Es compilación/validación, no despliegue.

No se certifica una lectura o escritura real de ML, la página actual de MEMOSOFT ni una llamada IA facturada a partir de estas pruebas. Las capturas combinan datos de archivos con casos operativos sintéticos, nunca una sesión productiva del propietario.
