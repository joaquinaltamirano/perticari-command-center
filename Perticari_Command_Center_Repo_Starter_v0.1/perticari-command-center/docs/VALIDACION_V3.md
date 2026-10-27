# Validación de V3

27/10/2026. Entorno local aislado; sin credenciales ni cambios en producción.

- Compilación: `npm run build`, correcta; Worker autónomo con interfaz y recursos PWA embebidos.
- Lógica/API: `node --test test/*.test.mjs`,118 pruebas aprobadas. Cubren estados de borradores/grupos, eliminación segura, plantillas sin cruce de familias, aplicación atómica, publicación de imágenes por hash, verificación de imágenes remotas y reconciliación, fuentes y preguntas, política monetaria, cotizaciones, cifradoVAPID/WebPush y permisos.
- Navegador: `node test/browser.cjs`, Chromium escritorio1440×1080 y móvil390×844; importación, lotes30, archivo/restauración, plantillas, imágenesZIP, edición, precios, entregas, fuentes, controles, atención, conocimiento, feedback y cierre de pregunta externa.
- Las pruebas de APIs usan respuestas sintéticas y no certifican acceso aML, MEMOSOFT oBNA reales. Las pruebas criptográficas verifican de forma independiente el descifrado del mensaje WebPush y firmaVAPID.
- Los intentos de acceso aMEMOSOFT/BNA/documentaciónML en este entorno resultaron bloqueados403. Geocodificación yOSRM tienen contrato contrastado con sus repositorios oficiales; la recepción de push y las rutas reales se deben comprobar en el dispositivo/entorno del propietario.
- No se desplegó enCloudflare desde este entorno. El paquete conserva configuración, D1 y secretos existentes cuando el propietario reemplaza el código según la guía.

Los recursos descargables incluyen versión y SHA256 para comprobar que el Worker copiado coincide con la entrega. Ningún paquete incorpora exportaciones comerciales, claves ni capturas con datos del cliente.
