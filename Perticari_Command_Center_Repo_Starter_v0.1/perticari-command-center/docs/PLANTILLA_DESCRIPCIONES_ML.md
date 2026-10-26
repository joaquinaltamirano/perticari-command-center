# Descripciones de Mercado Libre — plantilla propuesta para V3

Estado: para aprobación junto con [la especificación V3](V3_ESPECIFICACION_PARA_APROBAR.md). Basada en el texto aportado por Perticari el 26 de octubre de 2026. No se modificaron publicaciones.

## Formato de entrada y generación

El texto plano pegado en el chat, TXT o un documento editable sirve para el bloque común. Las especificaciones por producto se toman de fuentes verificadas o de una tabla con SKU, familia, presentación y atributos. No hace falta redactar una descripción completa por SKU.

La salida se construye como texto plano, sin HTML ni formato Markdown dependiente del visor. Usar títulos breves, saltos de línea y listas simples; validar límites y reglas de contenido vigentes de ML al publicar. Descripción, título y atributos estructurados deben coincidir.

Variables: nombre del producto; familia; material/terminación verificados; medidas con unidades; longitud o dimensiones de hoja; cantidad/presentación incluida; condiciones de entrega aplicables. Si falta un dato obligatorio, queda pendiente: nunca publicar llaves de plantilla ni rellenar propiedades por semejanza del nombre.

## Plantilla común

```text
PERTICARI & CIA
Más de 50 años en el rubro

{NOMBRE DEL PRODUCTO}

QUÉ INCLUYE
{PRESENTACIÓN Y CANTIDAD POR UNIDAD DE COMPRA}

MEDIDAS Y CARACTERÍSTICAS
{ATRIBUTOS VERIFICADOS CON NOMBRE Y UNIDAD}

RETIRO Y ENVÍOS
Retiro en nuestra sucursal de Barracas, CABA.
{MODALIDADES Y CONDICIONES APLICABLES A ESTE PRODUCTO}

PAGO Y FACTURACIÓN
Podés utilizar los medios de pago habilitados por Mercado Libre al comprar.
Emitimos factura A o B. Revisá tus datos de facturación antes de confirmar la compra.

HORARIO DE ATENCIÓN
Lunes a viernes de 8 a 16 h.
```

## Ejemplo con los datos proporcionados: planchuela

```text
PERTICARI & CIA
Más de 50 años en el rubro

PLANCHUELA DE HIERRO 3/4 X 1/8 — BARRA DE 6 METROS

QUÉ INCLUYE
Una barra de 6 metros por unidad de compra.

MEDIDAS
Ancho nominal: 3/4 de pulgada (19,1 mm).
Espesor nominal: 1/8 de pulgada (3,2 mm).
Largo: 6.000 mm (6 metros).

RETIRO Y ENVÍOS
Retiro en nuestra sucursal de Barracas, CABA.
Contamos con acarreo propio dentro de las zonas habilitadas. Consultá costo y plazo indicando localidad y código postal.
Para otros destinos, podemos entregar sin cargo en una sucursal de transporte de La Boca o Barracas, previa coordinación y aceptación de la carga por la agencia. El transporte posterior es a cargo del comprador.

PAGO Y FACTURACIÓN
Podés utilizar los medios de pago habilitados por Mercado Libre al comprar.
Emitimos factura A o B. Revisá tus datos de facturación antes de confirmar la compra.

HORARIO DE ATENCIÓN
Lunes a viernes de 8 a 16 h.
```

El ejemplo ilustra una presentación comercial concreta; comprobar que el SKU y la unidad de venta correspondan a una barra antes de aplicarlo. Las medidas nominales provienen de la descripción aportada, no de una certificación técnica independiente.

## Reglas de adaptación

- En chapas, mallas y metal desplegado, sustituir «barra» por la presentación por hoja confirmada y detallar ancho/largo/espesor o trama según corresponda. No usar los 6 metros del ejemplo como valor por defecto.
- Evitar rotular «Ancho» a una expresión que combina ancho y espesor. Separar cada dimensión y mostrar pulgadas/milímetros de forma coherente.
- No incluir usos, normas, capacidad de carga, soldabilidad o composición sin ficha/fuente suficiente.
- El bloque logístico cambia cuando haya una modalidad nativa de envío aplicable. No contradecir el costo o la promesa del checkout de ML.
- Las entregas sin cargo por peso/plazo se incorporan únicamente cuando la cobertura y las condiciones del producto/venta estén verificadas. No prometerlas de forma universal en todas las publicaciones.
- No enumerar efectivo, Rapipago, Pago Fácil ni cuotas como condiciones universales: mostrar los medios efectivamente habilitados en ML para esa compra.
- «Sin garantía» no se copia al texto común. La garantía se determina por producto en los campos correspondientes, con información correcta y conforme a lo aplicable; se revisan las publicaciones existentes antes de cambiarla.
- No agregar datos de contacto externo, enlaces promocionales ni invitaciones a sacar la operación de ML. Verificar las políticas de contenido vigentes antes de aplicar la plantilla.
- Mantener versión de plantilla y previsualización de diferencias. Una actualización del bloque común genera una propuesta de lote; no sobrescribe excepciones específicas sin identificarlas.
