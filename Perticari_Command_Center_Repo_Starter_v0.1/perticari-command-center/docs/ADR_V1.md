# Decisiones de la primera entrega · 2026-10-16

El usuario autorizó implementar la primera entrega tras definir las reglas comerciales en la conversación. Este documento actualiza las propuestas técnicas de Sprint 00 sin alterar los ocho documentos de la base.

## Runtime y persistencia

Monolito modular sobre el Worker existente de Cloudflare + D1, con React para la interfaz. Reemplaza la propuesta inicial Next.js/PostgreSQL para aprovechar la infraestructura gratuita ya creada y conservar el mismo dominio y OAuth. Un único bundle ESM contiene servidor y recursos estáticos; no lleva datos comerciales.

Node 24 para herramientas; el servidor usa Web APIs del runtime Workers. React 19.3.1, esbuild 0.25.12, wrangler 4.150.0, Miniflare 4.20260730.0, read-excel-file 9.3.12 y playwright-core 1.57.0 están fijados en package-lock.json. El build no requiere Vite, PostgreSQL, Python ni servicios de pago. El conversor opcional de archivos históricos utiliza Python/openpyxl/xlrd fuera del servidor.

## Fuentes

MEMOSOFT: autoridad del precio comercial de origen, con vigencia y presentación revisables. No es stock físico. El maestro viejo se usa para identificar productos, excluyendo sus cuatro columnas de precios. El Excel específico de precios aporta exclusivamente `Precio Original`, nunca la columna con +13%.

ML: autoridad del estado, precio publicado, preguntas y ventas. El snapshot técnico inicial preserva IDs, SKU y atributos; no aporta precios ni estados actuales. Los valores reales se obtienen al sincronizar la API una vez desplegado. Las métricas de ventas guardan ID, estado, moneda, importe y unidades, sin datos de compradores.

PCC: reglas, propuestas, aprobaciones y auditoría. El matching es exacto por SKU (solo trim), incluyendo varias publicaciones por SKU y variaciones identificadas. Una coincidencia no certifica equivalencia comercial.

## Reglas confirmadas por el usuario

- Cantidad comercial inicial 100, configurable; no es existencia física.
- Precio base de MEMOSOFT por 1,15 + cargo fijo aplicable al precio final. Es recargo, no margen neto ni compensación matemática de la comisión porcentual.
- Franjas iniciales: referencias aportadas en captura (1330 / 2740 / 3320 / 0 ARS, umbrales 15000 / 24000 / 33000 ARS). No certificadas como cargos oficiales vigentes. Requieren revisión explícita y caducan a las 24 h para ejecución. No se suma dos veces un fee oficial: esta entrega no integra listing_prices.
- Barras de 6/12 m detectadas en título; chapas, mallas y desplegados por hoja. Precio/unidad se confirma por producto. No hay conversiones inventadas por kg o metro.
- Acarreos USD20 /39,50 /79 desde San Antonio1250, Barracas; cotización ARS editable, identificada y con vigencia24h.
- Límites8/16/25km son propuestas, editables y sin confirmación inicial. Distancia por calles ingresada manualmente. Sin geocodificador/routing externo en esta entrega.
- Gratis >300kg dentro72h y sin mínimo dentro10d, únicamente con cobertura validada y destino revisado. Los plazos se conservan según lo indicado: falta calendarización de días hábiles/feriados.
- Agencia elegida por cliente; entrega sin cargo en sucursales de La Boca/Barracas. No se atribuye tarifa ni ETA al transporte posterior.
- Medios representativos por familia, recordatorios de imágenes y video; no generador gráfico.

## Acceso

Se conserva el OAuth ya probado por el usuario: mismo dominio, callback, cifrado y tablas. Se agregan sesiones TOTP con secretos cifrados y control de replay. Cada endpoint privado requiere sesión de contraseña y segundo factor; cada mutación verifica Origin. No se transfieren tokens al navegador.

Los tokens OAuth y el MFA derivan su clave de PCC_ADMIN_KEY, aplicación y origen. Rotar esos valores exige un procedimiento de reautorización/recuperación; no cambiarlos casualmente.

## Operaciones

Propuesta → revisión → aprobación idempotente → ejecución explícita → lectura de verificación → auditoría. Flags por defecto deshabilitados: PCC_ENABLE_ML_WRITES y PCC_ML_CONTRACT_VERIFIED. Son condiciones técnicas del piloto y no sustituyen la aprobación humana.

Una publicación con variantes/User Products no pasa por el escritor de precio legacy. La creación queda sujeta a categoría, atributos, imágenes y validación remota. Si el contrato actual no permite el payload legacy, la validación falla y se conserva el borrador; no se simula éxito.

Si una escritura pudo haberse enviado pero no se confirmó, queda en reconciliación. Nunca se reintenta automáticamente. Un timeout de creación sin ID remoto requiere revisión manual en ML. No existe autopricing ni stock automático.

## Asistente

Primera versión con reglas y evidencia: logística, presentación y prudencia de stock. No se envía contenido a proveedores externos de IA ni se afirma utilizar un modelo conectado. Se puede editar, guardar y aprobar la respuesta. La generación semántica con documentos y un proveedor de IA requiere configurar ese proveedor y ampliar pruebas de grounding.
