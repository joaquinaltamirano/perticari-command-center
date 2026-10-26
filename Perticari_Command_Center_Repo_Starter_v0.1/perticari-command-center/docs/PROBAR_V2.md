# Actualizar a Perticari V2

Usamos la misma dirección y el mismo Worker. No hace falta crear aplicaciones, volver a importar el catálogo ni cambiar las claves.

## Tres pasos

1. En Cloudflare, abrí **Workers & Pages → perticari-notificaiones → Edit code**. Abrí `Worker_Perticari_V2.js`, copiá todo y reemplazá el contenido completo de `worker.js`. Pulsá **Deploy**.
2. En **Settings → Trigger events → Cron Triggers**, reemplazá el cron anterior por **`* * * * *`** (cada minuto). Es necesario para trabajar con el navegador cerrado. Si usás Wrangler, la configuración incluida ya lo especifica.
3. Abrí **https://perticari-notificaiones.perticari-sa.workers.dev/app** y recargá con **Ctrl+F5**. Ingresá con tu contraseña y autenticador habituales si te los pide. Verificá el distintivo **V2**.

Las tablas nuevas se crean automáticamente de forma aditiva. Se conservan la cuenta conectada, MFA, productos, borradores e historial existente. Los trabajos viejos se conservan; su estado se ve en Configuración.

Antes de reemplazar el código, conservá una exportación privada de la D1 o su punto de recuperación de Cloudflare. No compartas esa exportación: contiene información comercial y credenciales cifradas. No cambies PCC_ADMIN_KEY: participa del cifrado de OAuth y MFA. Si tenés un despliegue con cambios propios posteriores, guardá también esa versión.

## Comprobar primero las preguntas

Abrí **Atención → Actualizar preguntas**. La búsqueda trae pendientes actuales; otro trabajo contrasta por ID las pendientes antiguas, de a tres para respetar recursos. Si hay muchas, se resuelven en sucesivos ciclos; el panel también procesa la cola mientras está abierto.

- Respondida en ML: pasa a Respondida.
- Eliminada con respuesta API 404/410: pasa a No disponible.
- Error de permisos o conexión: conserva el estado anterior y muestra el error.
- Se muestran por separado última búsqueda y última reconciliación.
- La pantalla consulta estados cada 15 segundos. Eso actualiza datos ya recibidos por el servidor; no implica que Mercado Libre se consulte cada 15 segundos.

La consulta programada se solicita cada minuto, sujeta a cola, errores, límites y disponibilidad de la API. Los webhooks persistidos también despiertan procesamiento. No hay promesa de tiempo real instantáneo.

Si dice autorización vencida o permiso rechazado, abrí **Administrar conexión ML** y renová la autorización. Después podés reintentar la lectura fallida en Configuración. No compartas tokens ni claves por chat.

## Qué probar después

- **Pedidos:** confirmar disponibilidad y pasar a preparación. Un faltante genera una excepción; permite aprobar una intención de pausa, sin cancelar la orden.
- **Centro de decisiones → Conocimiento:** cargar una respuesta habitual o condición comercial, indicar fuente y validarla. Luego preparar una respuesta en Atención y registrar si fue útil o corregida.
- **Resultados:** revisar oportunidades por producto/familia y registrar un experimento con hipótesis, métrica y período.
- **Precios:** comparar un escenario de costos; MEMOSOFT es precio público, no costo de compra. Revisar diferencias al importar precios y consultar historial desde un producto.
- **Centro de decisiones → Controles e IA:** comprobar el modo solo lectura y el control de sincronizaciones.

## IA opcional

La V2 funciona con reglas y conocimiento validado sin contratar un modelo. Para usar OpenAI, el dueño debe configurar el secreto **OPENAI_API_KEY** en Cloudflare y después indicar modelo compatible con Structured Outputs, tarifas vigentes y presupuesto diario en el panel. Solo entonces habilitar IA.

El presupuesto se expresa en USD, se controla por día UTC y utiliza reservas conservadoras. Las llamadas fallidas pueden conservar reserva para no exceder el límite; no se presentan como gasto facturado exacto. Las respuestas de IA nunca se envían solas.

No se activó ningún proveedor pago ni se gastó dinero durante el desarrollo.

## Escrituras comerciales

Los envíos, publicaciones, cambios de precio y pausas siguen supervisados. Requieren contrato de ML verificado para la cuenta, flags de piloto habilitados y aprobación en el panel. **No habilites flags solo para quitar un bloqueo sin validar primero el recurso correspondiente.** El modelo actual de User Products, Product Ads y costos debe comprobarse con documentación vigente y un piloto autorizado.

La V2 puede funcionar como herramienta de consulta y preparación mientras eso se valida.

## Si necesitás volver a V1

En Cloudflare → Deployments, restaurá la versión anterior del código. Las migraciones V2 agregan tablas y no cambian las columnas V1; no borres la D1. Los registros nuevos de V2 no aparecen en V1, pero permanecen en la base. Conservá primero una copia privada del estado actual.

El paquete no incluye datos iniciales: actualizar no requiere reimportar ni sobrescribir los datos que ya probaste.
