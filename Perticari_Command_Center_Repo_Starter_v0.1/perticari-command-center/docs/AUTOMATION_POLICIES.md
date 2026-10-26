# Políticas V2

- Autonomía efectiva inicial: lecturas programadas, propuestas y preparación interna. Toda escritura comercial requiere aprobación humana y habilitación técnica.
- IA opcional desactivada por defecto. Modelo, tarifas, credencial y presupuesto positivos son necesarios para activarla. Identidades de las citas se validan; la exactitud semántica se revisa por humano.
- El conocimiento requiere fuente, versión y validación explícita. Borradores, fuentes obsoletas y expiradas no se recuperan como conocimiento aprobado. Corregir una sugerencia no valida una regla automáticamente.
- Precio MEMOSOFT = precio público. Fórmula vigente +15% y cargo fijo; fechas, presentación y cargos se verifican antes de aprobar/ejecutar. Un borrador no puede publicarse con precio distinto de la fórmula vigente sin cambiar la política explícitamente.
- Cantidad comercial no es stock físico. Preparar/coordenar/entregar requiere disponibilidad real confirmada. Faltante permite intención de pausa aprobada; no cancela una venta.
- Aprobaciones caducan a las 24 h. Revalidar fuentes y estado remoto al ejecutar. Una acción fallida antes de envío puede aprobarse de nuevo; una incierta no se reenvía. Reconciliación solo lee y confirma resultados coincidentes; creación sin ID requiere revisión manual.
- Solo lectura bloquea escrituras desde backend y adaptador ML. Pausar trabajos suspende lecturas programadas/manuales de cola, no elimina datos ni impide operar el catálogo. Apagar IA no impide reglas y edición manual.
- Una caída no se interpreta como éxito, stock cero o pregunta respondida.
- No hay autonomía publicitaria ni contratación de servicios. Experimentos registrados no son autorización de gasto ni ejecución de campañas.
- SLA: objetivo interno configurable, inicialmente propuesto en 30 minutos de tiempo transcurrido. No promete atención 24/7; no descuenta horarios sin un calendario confirmado. Mediana/p90 solo usan fechas remotas conocidas y muestran tamaño de muestra.
- Roles actuales: propietario/administrador protegido por MFA. Multiusuario con roles granulares y delegación sigue pendiente; no presentarlo como disponible.
