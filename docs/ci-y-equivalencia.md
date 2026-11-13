# CI preparada y auditoría de equivalencia

Fecha: 13 de noviembre de 2026. Estado de la auditoría original: **preparación y verificación locales, sin cambios remotos**. La publicación posterior fue autorizada el 13 de noviembre de 2026; el workflow conserva solo disparo manual y no se ejecuta como parte de publicar. La carpeta local `.codex/` pertenece a la autorización de pruebas del usuario y no se modificó ni se incorpora a esta preparación.

## Alcance y punto de comparación

Se revisó la secuencia local de refactorización:

| Referencia | Cambio auditado                                                              |
| ---------- | ---------------------------------------------------------------------------- |
| `c65e5ba`  | Patrón de errores por campo y conservación de formularios                    |
| `5a7e615`  | Contexto de navegación, incluido Resumen/Logística                           |
| `c4fe995`  | Separación DB/demo/correo, migraciones numeradas, reglas, permisos y estados |
| `6963f26`  | Fotos externas fuera de transacciones largas y compensación                  |
| `bbe06c3`  | Intentos de correo y resultados inciertos                                    |
| `ad2459f`  | Acciones por funcionalidad y controles de configuración/seguridad            |

La comparación consiste en revisión de los cambios de fuente y contratos, pruebas actuales con resultados esperados y comparación de caminos canónicos/adaptadores. **No es un ensayo diferencial que ejecute todas las versiones históricas contra el mismo fixture**, ni una prueba de equivalencia matemática. El adaptador y el camino canónico terminan en el mismo servicio: su igualdad detecta errores de contrato, no demuestra por sí sola igualdad con el algoritmo histórico. Las pruebas de negocio con PostgreSQL real e invariantes independientes aportan la evidencia adicional.

No se accedió a archivos `.env.production.local`, DB beta, permisos reales, Graph, Exchange, SharePoint ni Vercel. Solo se consultaron fuentes públicas para herramientas/avisos de seguridad. No hubo correos reales, cargas externas ni fixtures en la base de aplicación.

## Pipeline preparada

`.github/workflows/ci.yml` tiene **solo `workflow_dispatch`**: no se dispara por push/PR. La autorización posterior permite subir el archivo en modo manual; su primera ejecución remota continúa pendiente. No hay job de publicación. La habilitación posterior de PR/push o required checks necesita autorización aparte.

| Job           | Comprobaciones y aislamiento                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `quality`     | Instalación, contrato de CI, TypeScript en copia nueva con `next typegen`, Biome y formato de los archivos administrados de CI |
| `unit`        | Suite pura y suite aislada de navegación; cobertura por módulo y artefactos LCOV/resumen de siete días                         |
| `contracts`   | Fronteras funcionales/server-only, inventario de autorización, Auth.js y correo con dobles                                     |
| `integration` | Servicio PostgreSQL 18.0 Alpine con digest; runner sin dotenv, una DB desechable por grupo; Graph simulado                     |
| `build`       | Compilación y arranque Next en copia temporal sin .env, endpoints locales, headers y rechazo de importación DB al cliente      |
| `security`    | Escáner de secretos de archivos publicables e historial disponible, más `npm audit` de producción/desarrollo                   |

Acciones oficiales fijadas por SHA, permisos `contents: read`, checkout sin credenciales persistentes, límites de tiempo y concurrencia cancelable. Solo se suben artefactos explícitos de cobertura unitaria; no `.env`, snapshots de personas, cuerpos de correo, logs SQL ni capturas del navegador. El historial completo se solicita donde se escanean secretos. No hay `pull_request_target`, secretos beta, OIDC, tokens de despliegue ni cambios de permisos.

### Instalación reproducible y herramientas

- `npm ci --ignore-scripts --no-audit --no-fund`, con `package-lock.json` versionado. No ejecuta postinstall/prepare del proyecto o dependencias. Las pruebas/build son pasos explícitos. Verificado en una carpeta temporal; lockfile intacto y módulo nativo `sharp` operativo. Esa misma instalación ejecuta explícitamente `next build` con Turbopack en copia sin .env, DB imposible y fetch bloqueado; el job también conserva el build/HTTP con Webpack de la suite de seguridad.
- Herramientas nuevas fijadas por versión exacta: Biome, Prettier, YAML y Secretlint/preset. Versiones de Node/npm de CI en `.node-version` y `scripts/ci/runtime.json`; npm también en `packageManager`.
- CI replica **Node 25.2.1 / npm 11.7.0**, la combinación local comprobada. No se agrega `engines.node=25` al paquete: no se impone ese runtime al despliegue de Vercel. Node 25 no es una elección LTS; antes de activar CI de forma permanente se debe validar una versión LTS soportada por el alojamiento y actualizar los pines juntos. No se afirma que la matriz Linux/LTS ya se haya verificado.
- El parser de ESLint consultado exige TypeScript `<6.1` y el proyecto usa TypeScript 7.0.2. No se utilizó `--force`/`--legacy-peer-deps`; Biome realiza lint sintáctico y TypeScript verifica tipos. No se cambió el compilador.
- La imagen oficial PostgreSQL se fija por digest de manifiesto; el pin se consultó como metadato público. No se ejecutó Docker/Linux en esta máquina: la integración local usó PostgreSQL 18.6 del entorno local. La compatibilidad exacta con el contenedor 18.0 y sus avisos de seguridad queda para la primera ejecución autorizada, no se presenta como comprobada.

### Formato y lint: alcance explícito

`npm run lint` analiza `app`, `lib`, `scripts`, `tests` y `next.config.ts`: errores de sintaxis y siete reglas de alta señal (código inalcanzable, finally inseguro, dirección de for inválida, debugger, comparación con -0 y claves/props JSX repetidas). Sin autofix ni supresiones masivas. **No equivale al conjunto completo de React Hooks, accesibilidad, complejidad o seguridad.** Ampliar reglas por etapas sigue pendiente.

`npm run format:check` usa Prettier para workflow, configuración de herramientas, manifiestos, scripts/tests nuevos de CI y este informe. No reformatea miles de líneas del legado para esta tarea. El estilo histórico compacto de `app/lib/tests` se mantiene y no se presenta como totalmente normalizado. La uniformización gradual de formato del resto sigue pendiente.

### Runner de integración sin credenciales beta

`npm run test:integration:ci` acepta únicamente `CI_DATABASE_URL` PostgreSQL loopback con base administrativa `postgres` o `asvo_ci_admin`, sin query/fragmento. Rechaza variables de aplicación (`DATABASE_URL`, Auth, Graph, SharePoint, Vercel) heredadas antes de consultar SQL. Pasa un entorno limpio al runner ya existente con `--skip-contracts`: contratos tienen su job separado; la integración conserva todos los grupos SQL sin repetir aquella suite. No carga archivos .env. La URL administrativa solo crea/elimina DB de prueba, no recibe fixtures.

El servicio del workflow usa credenciales **ficticias públicas** válidas solo en su contenedor efímero, con puerto publicado en loopback. Las bases se nombran con UUID y se comprueba el destino antes de escribir. Cada proceso hijo recibe credenciales Graph sintéticas y bloquea fetch externo, sustituido explícitamente por dobles cuando se prueba el adaptador real. No se reemplaza el algoritmo de cupos/autorización por un doble. Los guards y `finally` existentes limpian DB/fixtures; SIGKILL/caída del runner pueden impedir `finally`, aunque el servicio de Actions es efímero.

## Equivalencia funcional y cambios intencionales

| Flujo                                          | Comportamiento conservado/evidencia actual                                                                                                                                                                                  | Cambio deliberado o límite                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inscripción pública y enlace privado           | `public-registration`, `registration`, `security`: nueve dígitos, póliza/unidad, diferencias de mensajes, fechas flexibles, datos inválidos, cupos/espera, cancelación, promoción e idempotencia; correo simulado           | Revocación/propósitos explícitos y nuevos límites HMAC son endurecimientos intencionales, no equivalencia literal con el comportamiento anterior inseguro |
| Coordinación: alta/edición/decisiones          | `staff-forms`, `functional-actions`, `workflow-transitions`: permisos, motivos, versiones obsoletas, errores múltiples, recuperación, concurrencia y rollback atómico                                                       | Acciones canónicas por funcionalidad; adaptadores compatibles retenidos                                                                                   |
| Fichas/pólizas/unidades/incidentes/importación | `registry-forms`, `authorization`: atribuciones Admin/Coordinación, General obligatorio, CSV por campo, preview sin escritura, confirmación y reintento                                                                     | Configuración/entorno ahora falla cerrado; nunca se usan permisos reales en los fixtures                                                                  |
| Convocatorias/series/herencia                  | `outing-forms`, `outing-editor`, `functional-actions`, `form-audit`: bloques múltiples, alcance explícito, edición directa/heredada, IDs repetidos, fechas/cupo y agrupación concurrente                                    | JSX sin consumidores retirado; consulta de conflictos compartida. No se retiraron adaptadores con consumidores                                            |
| Fotografías                                    | `photo-uploads`, unitarias de metadatos y contratos: portada, seis fotos, galería/nueva, autorización antes de bytes/carga, revalidación, archivos preparados, fallos/timeouts, carreras y compensación                     | Graph ya no se ejecuta con filas bloqueadas; reserva durable/limpieza explícita; cero cargas reales                                                       |
| Correo                                         | `mail-outcomes`, `registration`, contratos y unitarias: plantillas, destinatarios, `.test`, orden, reserva, dos workers, aceptación y proyección fallida, rechazo/timeout/revisión explícita                                | Resultado incierto ya no se reenvía ciegamente. `sent_at` no significa entrega. No se promete exactamente una vez                                         |
| Informe del 70/asistencia                      | `workflow-transitions`, `outing-forms`, `functional-actions`, `volunteer-participation`: borrador editable sin acreditar asistencia; finalización bloqueada, asignación/vigencia, contradicciones y conciliación versionada | No se confirmó una nueva UX visual del 70 en navegador en esta auditoría                                                                                  |
| Navegación y formularios                       | Unitarias de navegación/errores, auditorías de dependencias y pruebas de acciones sin invalidación falsa tras error                                                                                                         | Foco, posición, disclosure, archivos y distribución reales requieren navegador; la suite CUA se conserva, pero no se volvió a ejecutar completa aquí      |
| Distribución móvil y estilos                   | Revisión del diff: no se cambiaron CSS ni componentes de catálogo/brief como parte de esta preparación; evidencias CUA previas en `tests/navigation` y `tests/functional`                                                   | Ausencia de cambios CSS no demuestra equivalencia visual. Pendiente repetir recorridos desktop/móvil y lectores reales                                    |
| Esquema/historial                              | `schema-migrations`: vacío, adopción compatible/incompatible, checksum, rollback parcial, ejecuciones concurrentes, marcas históricas, cola/datos/enlaces conservados y segunda ejecución                                   | 0001–0004 ya existen; esta tarea no introduce migración ni la ejecuta contra beta                                                                         |

### Ausencia de efectos implícitos

`db-commands` prepara/repite esquema sin credenciales Graph y compara tablas de personas, salidas, registros, enlaces, auditoría, cola, recordatorios, invitaciones y fotos. Las transformaciones históricas son explícitas y no encolan comunicaciones. Los mensajes ya existentes se preservan; no se procesa la cola al migrar. `schema-migrations` comprueba adopción sin repetir cambios históricos.

El build usa una DB deliberadamente imposible y fetch externo bloqueado. El preload escribe marcadores sin datos antes de rechazar fetch o una conexión al puerto reservado 1; los wrappers comprueban su ausencia, aunque la aplicación capture el error. Un contrato inyecta ambos intentos y verifica que los marcadores permanezcan visibles. El arranque y las rutas privadas inválidas/Auth.js providers/cron no autorizado se comprueban sin DB ni proveedores; el cron no recibe un secreto y no envía nada. Esto aporta evidencia de las rutas ejercitadas, no una prueba universal de que ningún módulo pudiera iniciar un efecto en otra ruta. No se prueba un envío real ni una restauración de backups.

## Secretos y dependencias

`security:secrets` usa Secretlint/preset sobre archivos publicables y `git log --all -p` local, sin leer dotenv privados del árbol de trabajo ni enviar código a un tercero. Si un dotenv hubiera sido versionado históricamente, su diff también se escanea en memoria y solo se informa la ubicación/regla. Se revisan commits disponibles, no objetos eliminados/inaccesibles, backups ni archivos ignorados. En CI `fetch-depth: 0` solicita historial completo disponible; la prueba no certifica ramas/objetos que no se hayan descargado.

La salida JSON del escáner puede contener el código fuente original. El wrapper la mantiene en memoria y escribe exclusivamente archivo/línea/regla/código, nunca mensajes, fragmentos ni valores. Se verificó con una credencial sintética construida en memoria. Hay tres excepciones de texto exacto para URLs ficticias: el template de loopback del test histórico y las dos conexiones locales públicas del fixture CI. No se ignoran todos los tests, archivos de configuración ni la historia. Cualquier hallazgo nuevo o informe inválido falla; no se hacen rotaciones automáticas.

`security:dependencies` consulta npm con configuración aislada sin credenciales personales, informa todas las severidades y bloquea high/critical; error de red/informe inválido también falla. No ejecuta `audit fix`. Resultado local del lockfile actual: **cero avisos reportados por npm**. La ausencia de avisos conocidos no prueba ausencia de vulnerabilidades. No se realizó análisis de imagen del contenedor, firmas/procedencia, DAST ni revisión exhaustiva de cadena de suministro.

## Pruebas ejecutadas y cobertura

- `ci:install:verify`: instalación limpia desde el lockfile, sin scripts, sharp y build Turbopack operativos; carpeta retirada.
- `ci:typecheck`: generación de tipos y TypeScript en copia sin archivos generados previos ni .env.
- `lint`, `format:check` y `test:ci`: sintaxis/reglas, formato administrado y contratos de seguridad de la pipeline.
- `test:unit:coverage`: **92 casos**, incluidos los 20 aislados de navegación; **35 módulos puros declarados**, 100 % líneas, 96,53 % ramas y 99,53 % funciones. No es cobertura global de React/SQL/servidor. No se impuso un umbral global engañoso.
- `test:contracts`: cinco inventarios/contratos, incluidas 73 exportaciones en 24 archivos y fronteras de ocho módulos funcionales/diez servicios.
- `test:integration:ci`: **18 grupos** sobre DB desechables; incluye las siete familias funcionales y los fallos/concurrencia anteriores.
- `test:security:build`: compilación, arranque y HTTP locales, headers y rechazo real de importación DB desde cliente; copia/servidor retirados.
- `security:secrets` / `security:dependencies`: comprobaciones locales con informes saneados en `coverage/` ignorado por Git.

Los seis contratos específicos de CI se ejecutan por separado: no se suman a las 92 unitarias ni a su denominador de cobertura.

### Navegador: dependencia de CUA conservada

`tests/navigation/browser.mjs` y su preparación/limpieza se mantienen. Requieren una sesión CUA, pestaña, capacidades viewport y fixtures locales. **No hay un job autónomo de navegador en este workflow.** Las unitarias prueban reglas y el contrato del controlador; no sustituyen ejecución real del DOM ni layout móvil.

Evidencias anteriores: 26 grupos de navegación asistida registrados en `tests/navigation/browser-results.json` y regresión enfocada de la reorganización en `tests/functional/browser-results.json`. Se conservan con su alcance y fecha; no se renombraron como una ejecución nueva de CI. En esta etapa no se ejecutó una nueva auditoría CUA de todos los formularios/fotos/70/móvil. Pendiente hacerlo antes de declarar equivalencia visual completa o reemplazar CUA por un runner E2E autónomo mediante una tarea separada.

## Publicación y activación posteriores

1. Revisar este diff y los pendientes. Esta preparación no modifica la aplicación funcional ni añade migraciones; las dependencias nuevas son herramientas de desarrollo.
2. Validar runtime LTS de destino y la primera ejecución Linux/PostgreSQL del workflow. Verificar renovación de pines/imagen y avisos de seguridad; no afirmar CI verde remoto antes de ejecutarlo.
3. Con autorización expresa, subir el archivo manual y ejecutarlo por primera vez. Solo después valorar disparadores PR/push, required checks o protección de ramas: **no se configuraron aquí**.
4. Repetir la suite CUA con datos ficticios, desktop/móvil, enlaces públicos/privados, fotos, informe del 70, modales, errores/foco y regreso contextual. Registrar fallos y retirar fixtures.
5. Revisar estado/plan de migraciones y configuración offline del entorno que se vaya a publicar, usando credenciales de mantenimiento elegidas explícitamente. No hay migración nueva de esta tarea. No copiar credenciales ficticias de CI a Vercel.
6. Solo con autorización de despliegue: coordinar los cambios operativos de etapas anteriores (0002–0004 cuando correspondan, workers, limpieza compensatoria y revisión de correos inciertos), publicar y hacer smoke tests sin disparar correos de prueba a personas reales.
7. Retención, privilegios efectivos, CSP estricta, logs del proveedor y backups siguen según sus documentos y requieren decisiones/comprobación de infraestructura; no se marcan completos por preparar CI.

Referencias: [servicios PostgreSQL en GitHub Actions](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers), [uso seguro de Actions](https://docs.github.com/en/actions/reference/security/secure-use), [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/). Para Next se leyó la documentación instalada de CI, ESLint y `next typegen`, correspondiente a la versión del proyecto.

## Registro de publicación posterior

El 13 de noviembre de 2026 se autorizó publicar esta preparación. No hay migración de base nueva. Se conserva únicamente workflow_dispatch, sin ejecución manual solicitada, disparadores PR/push, required checks ni cambios de reglas. La autorización de publicación no convierte las comprobaciones Linux/LTS/CUA pendientes en controles verificados. Las comprobaciones locales de tipo, seis contratos CI, lint, formato y secretos se repitieron antes del commit.
