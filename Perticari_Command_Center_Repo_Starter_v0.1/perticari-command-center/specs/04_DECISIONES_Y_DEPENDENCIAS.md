# Registro de decisiones pendientes, dependencias y riesgos — v0.1

**Estados:** BLOQUEANTE (impide determinada integración o automatización); REQUERIDO (para módulo); POSPUESTO (no impide primer MVP).

| ID | Estado | Pregunta o evidencia faltante | Qué bloquea | Próximo paso |
|---|---|---|---|---|
| PD-01 | BLOQUEANTE | Excel actual de publicaciones ML (IDs, SKU, título, precio, categoría, variaciones) | Conciliación real | Exportar y revisar columnas |
| PD-02 | BLOQUEANTE | Excel MEMOSOFT (familia, SKU, unidad, precio, costo, IVA, moneda, pesos, medidas) | Importador, pricing | Proveer muestra desidentificada |
| PD-03 | BLOQUEANTE | 1:1/1:N SKU ↔ presentaciones/publicaciones, validez identificador | Modelo correcto | Auditar duplicados y SKU vacíos |
| PD-04 | BLOQUEANTE para escrituras | Quién autoriza integración API empresarial; titularidad app y política de continuidad | OAuth producción | Acordar con Perticari por escrito |
| PD-05 | BLOQUEANTE para pricing automático | Margen mínimo, estructura IVA en costo, tratamiento impuestos, política de pérdidas | Publicar precios sin pérdida | Validar con responsable comercial/contable |
| PD-06 | BLOQUEANTE para pricing automático | Fuente y vigencia USD→ARS por precios y fletes | Conversiones monetarias | Definir tasa, horario y contingencia |
| PD-07 | BLOQUEANTE para pricing automático | Factores por familia: precio/kg→peso de unidad; precio/m→longitud; redondeos | Precio unitario | Tabla de conversiones y casos reales |
| PD-08 | BLOQUEANTE para stock | Stock MEMOSOFT confiable y reglas de reserva | Auto-stock y promesas | Comparar muestra con depósito |
| PD-09 | REQUERIDO logística | Tres tarifas USD, localidades y cobertura exacta | Shipping Brain | Recibir tabla y mapa autorizado |
| PD-10 | REQUERIDO logística | Excepciones de envío, zonas fuera de cobertura, devoluciones | Cotización segura | Documentar política comercial |
| PD-11 | POSPUESTO | Empresa Flex, costos, dimensiones y cobertura | Flex | Cotizaciones proveedor |
| PD-12 | POSPUESTO | Elegibilidad de cuenta para ME1 | ME1 | Verificar en cuenta/docs |
| PD-13 | BLOQUEANTE infra | Presupuesto mensual servidor DB worker IA email push backups | Elección proveedor | Solicitar techo y titular de pagos |
| PD-14 | BLOQUEANTE infra | Protocolo de acceso personales con datos de Perticari | Despliegue con datos reales | Consentimiento, confidencialidad y transferencia |
| PD-15 | REQUERIDO | URL/dominio y HTTPS para OAuth/PWA | Despliegue API | Elegir dominio/URL pública |
| PD-16 | REQUERIDO | Política retención datos personales/historial; quién puede borrar/exportar | Historial + IA | Definir mínimos, plazo, revocación |
| PD-17 | REQUERIDO | Proveedor IA y gasto máximo; fuentes FAQ y políticas aprobadas | Asistente IA | Cargar documentación autorizada |
| PD-18 | REQUERIDO | App ML registrada, scopes, endpoints habilitados para cuenta real | Integración lectura/escritura | Registrar y testear lectura |
| PD-19 | REQUERIDO Growth | Históricos ventas/ads/visitas + fechas, gasto real | Baseline/diagnósticos | Exportar 90 días y previos posibles |
| PD-20 | REQUERIDO Growth | Presupuesto Ads aprobado (1k–3k ARS diarios tentativa) | Recomendaciones económicas | Confirmar con empresa |
| PD-21 | REQUERIDO | Meta de ARS 10M/mes: fecha y definición ventas brutas/netas | KPI de meta | Acordar criterio |
| PD-22 | POSPUESTO | Configuración exacta Push en iOS/Android y fallback email | Notificación robusta | Test por dispositivo |

## Riesgos prioritarios
1. **Titularidad personal vs negocio:** la empresa es titular de la cuenta ML, datos y operación. Evitar dependencia del empleado con permisos irreversibles y dominio inaccesible. Mitigar: autorización formal, cuentas separadas, exportación y plan de transferencia, registros y revocación.
2. **Precios equivocados:** error de unidad, IVA, FX o cargo ML. Mitigar: tipos de unidad/moneda, validación independiente, dry-run, margen/topes, muestras manuales, freno de emergencia.
3. **Estado de inventario dudoso:** se venden unidades que no existen. Mitigar: no autosincronizar stock, calificar confianza, confirmación manual.
4. **IA alucinando:** puede prometer medidas, fecha o envío. Mitigar: grounded retrieval, advertencias, aprobación humana, reglas de contenido, pruebas adversariales.
5. **Webhooks duplicados o perdidos:** respuesta duplicada o pregunta invisible. Mitigar: dedup, cola durable, reconciliación periódica, check remoto antes de escritura.
6. **Tokens caducados o robados:** interrupción/abuso. Mitigar: cifrado, rotación/locks, acceso mínimo, monitoreo y revocación.
7. **Dependencia de API:** cambios en User Products/Ads/fees. Mitigar: adaptadores versionados, smoke tests, fallback manual.
8. **Servicios cloud demasiado baratos:** procesos dormidos, push retrasada, falta backups. Mitigar: validar SLO y costo antes de elegir proveedor.

## Contratos de decisión que se deberán firmar/aprobar
- Política de precios: fórmula, IVA, cambio, margen mínimo, topes y excepciones.
- Política logística: tarifas/cobertura, preparación, modalidades y destinatario del costo.
- Política de automatización: módulos autorizados, quién aprueba y reglas para deshabilitar.
- Política de custodia y acceso a la información comercial de la empresa.

## Checklist de archivos solicitados (sin secretos)
- [ ] XLSX publicaciones ML completo.
- [ ] XLSX maestro MEMOSOFT (con SKU, precios, costos y unidades); versión anonimizada si hay campos sensibles.
- [ ] 10 productos representativos: caño, chapa, perfil, malla, metal desplegado y caja.
- [ ] 10–20 preguntas preventa históricas con datos personales ocultos.
- [ ] Tarifas y cobertura de tres acarreos (cuando estén).
- [ ] Historial ventas/publicidad y datos de devoluciones/cancelaciones.
- [ ] Fichas y políticas comerciales vigentes para FAQ.

**No enviar:** contraseñas, client secrets, access/refresh tokens ni datos de clientes identificables al repositorio ni a prompts de desarrollo.
