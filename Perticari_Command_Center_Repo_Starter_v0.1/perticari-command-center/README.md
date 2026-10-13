# Perticari Command Center

Centro comercial privado para Perticari & CIA S.A. Canal inicial: MercadoLibre Argentina. Un administrador, escritorio y celular.

**Estado: preparación documental.** Este paquete no contiene una aplicación ejecutable, dependencias instaladas, CI, conexión con ML ni despliegue. Las especificaciones v0.1 se conservan sin cambios. Las observaciones del sprint son propuestas pendientes de acuerdo.

## Preparar el repositorio

1. Crear `perticari-command-center` en GitHub como **Private**. Si es nuevo, dejar desactivada la creación automática de README, `.gitignore` y licencia; el paquete ya incluye los dos primeros.
2. Copiar el contenido de esta carpeta en la raíz del repositorio local, incluyendo los archivos que empiezan con punto. Deben quedar `README.md`, `AGENTS.md` y `specs/` directamente en la raíz, sin otra carpeta intermedia.
3. Revisar los archivos y hacer el primer commit: `chore: prepare project baseline`. Subirlo a la rama `main` con Git o GitHub Desktop.
4. Trabajar después con una rama y una pull request por tarea; revisar y fusionar al completar los criterios de aceptación. Si el plan permite proteger este repo privado, exigir PR y bloquear force push/eliminación. Si sos el único revisor, no exigir una aprobación de otra persona. Configurar checks obligatorios cuando exista CI y haya ejecutado sus checks.
5. Crear o seleccionar un entorno de Codex Cloud con este repositorio y comprobar que puede leer `AGENTS.md` y los ocho archivos de `specs/`. La preparación inicial es documental; no hace falta instalar Next.js ni cargar credenciales comerciales para auditar.

En Codex Cloud actual: `Work in > Cloud` → seleccionar/crear entorno → elegir repositorio y conectar GitHub si lo solicita → revisar configuración → publicar **el entorno de trabajo** → iniciar tarea. Publicar ese entorno no despliega la aplicación de Perticari.

## Qué contiene

| Ruta | Propósito |
| --- | --- |
| `specs/` | Los ocho documentos originales de la base v0.1. |
| `AGENTS.md` | Instrucciones del proyecto para Codex. |
| `docs/SPRINT_00.md` | Objetivo, observaciones preliminares, insumos y primera tarea. |
| `.github/pull_request_template.md` | Formato de entregas y revisión. |
| `.gitignore` | Excluir secretos, archivos privados y salidas locales del versionado. |
| `.gitattributes`, `.editorconfig` | Convenciones de texto consistentes entre Windows y Linux. |

## Datos y acceso

- Guardar exportaciones comerciales en un canal de acceso restringido, fuera del historial Git. El repo solo recibe fixtures sintéticos o muestras desidentificadas revisadas y autorizadas.
- No subir contraseñas, tokens, claves privadas, archivos `.env` ni datos de compradores. `.gitignore` no elimina archivos ya versionados y no protege una subida manual desde la web de GitHub.
- Todavía no se definieron variables de entorno, runtime, gestor de paquetes, ORM, hosting o proveedor de autenticación; se documentarán junto con el primer scaffold. No hay comandos `install`, `build` o `test` disponibles todavía.

## Dirección propuesta

Next.js + TypeScript + PostgreSQL, backend modular y worker cuando se implementen tareas persistentes. Core → importación MEMOSOFT → ML solo lectura → reconciliación → Sales Copilot → pricing en simulación. Las elecciones de librerías, despliegue y costos requieren el sprint técnico y documentación vigente.

## Referencias de configuración

Consultadas el 2026-10-13:

- [Codex Cloud](https://learn.chatgpt.com/docs/cloud)
- [Instrucciones AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Protección de ramas y disponibilidad por plan](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [Aprobaciones de pull requests](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews)

GitHub documenta protección de ramas privadas para Pro/Team/Enterprise. Si el plan actual no la permite, mantener el flujo de PR y revisión manual; esto no impide comenzar.
