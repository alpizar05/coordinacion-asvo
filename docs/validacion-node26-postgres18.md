# Validación local de Node 26.13.1 y PostgreSQL 18.7

Fecha: 13 de noviembre de 2026. macOS Darwin arm64. Cambios locales, sin publicación ni ejecución remota de CI.

## Versiones y evidencia

| Entorno | Versión | Evidencia y límite |
| --- | --- | --- |
| Vercel, configuración | Node 26.x | Aportada por el usuario; no se consultó ni modificó el proveedor. |
| Vercel, build observado | Node v26.13.1 | Log aportado por el usuario. No demuestra el parche de las funciones. |
| Vercel, funciones | Parche no comprobado | Pendiente de observación autorizada. |
| Neon | PostgreSQL 18.7 | Consulta anterior informada; no se accedió a Neon en esta tarea. |
| Local aislado | Node 26.13.1 / npm 11.7.0 | Proceso principal e hijos comprobados; npm instalado en prefijo temporal. |
| Local aislado | PostgreSQL 18.7 / 180007 | Consulta SELECT current_setting('server_version'), current_setting('server_version_num') al servidor temporal antes de crear fixtures. |
| CI preparada | Mismos pines; postgres:18.7-alpine por digest | Workflow solo manual; Ubuntu, contenedor y primera ejecución remota siguen sin verificar. |

`.node-version` y `scripts/ci/runtime.json` fijan Node. `packageManager` ya fijaba npm 11.7.0 y se conserva: su engines admite `^20.17.0 || >=22.9.0` y pasó instalación/ejecución con Node 26.13.1. No se actualizaron dependencias de aplicación, package-lock ni engines.node. Tampoco comandos de despliegue, perfiles, Node/npm globales, AGENTS o reglas de Codex.

### Distribuciones verificadas

- Node oficial: [archivo y manifiesto](https://nodejs.org/download/release/v26.13.1/SHASUMS256.txt), archivo node-v26.13.1-darwin-arm64.tar.gz, SHA256 `aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735`.
- PostgreSQL: [fuente oficial 18.7](https://ftp.postgresql.org/pub/source/v18.7/), postgresql-18.7.tar.bz2, SHA256 `441dfae4280cae3e0425e5f876f80559fb0731c140f1aae22b3e5a54d0411bfd`. Compilado en directorio temporal, sin instalar globalmente, con `--without-readline --without-zlib --without-icu`; sin SSL de proveedor. No certifica esas extensiones/opciones ni la distribución Neon.
- No había Docker. El paquete embedded-postgres disponible era 18.6, por lo que no se usó como sustituto de 18.7. No se actualizó el clúster persistente de desarrollo.
- [Metadatos públicos oficiales Docker Hub](https://registry.hub.docker.com/v2/repositories/library/postgres/tags/18.7-alpine): digest del índice `sha256:75dcac3dfb1cd01ca3536910bbc84128759362f8b118bf8c55b38a94f68f3b73`; manifiesto Linux amd64 publicado `sha256:fa1b61f5a4844f4d4b73c9b15716cfc75fe70c931f2d32723630f3b900056366`. El workflow fija el índice completo. Se verificaron metadatos, no se descargó/ejecutó la imagen ni se escanearon sus paquetes.

## Incompatibilidad corregida

Node 26 eliminó `transform` y `sourceMap` de `module.stripTypeScriptTypes` ([documentación de la versión](https://nodejs.org/download/release/v26.13.1/docs/api/module.html#modulestriptypescripttypescode-options)). La primera integración falló con ERR_INVALID_ARG_VALUE en security antes de avanzar al resto. Cuatro cargadores de pruebas (security, authorization, functional-actions y photo-uploads) usaban mode transform; se cambió a strip. Los módulos cargados no requieren enums/namespace/parameter properties transformados. La integración completa posterior comprueba que el código real se sigue ejecutando; no se sustituyen sus reglas ni se agrega un compilador/dependencia.

registerHooks, resolución TypeScript, node:test, reporters/coverage V8, procesos hijos, AsyncLocalStorage y sharp quedaron ejercitados por las suites. TypeScript y el compilador nativo de Biome también se ejecutaron. La cobertura sigue siendo experimental de Node, no una garantía de estabilidad entre versiones futuras.

## Reproducción y protección del destino

Prepará Node 26.13.1 y npm 11.7.0 en un directorio temporal o con tu gestor, sin reemplazar el global. Anteponé su bin a PATH para que npm y los hijos por PATH usen el mismo Node. El guard explícito `node scripts/ci/check-runtime.mjs` verifica process.versions.node, un hijo process.execPath, otro node por PATH y npm --version; falla si difieren de runtime.json. Cada job CI lo ejecuta después de instalar dependencias. No se importa al iniciar Next ni al compilar.

Ejecutá desde el proyecto, con ese PATH y sin credenciales heredadas:

```sh
node scripts/ci/check-runtime.mjs
npm ci --ignore-scripts --no-audit --no-fund
npm run ci:install:verify
npm run ci:typecheck
npm run lint
npm run format:check
npm run test:unit:coverage
npm run test:contracts
npm run test:ci
npm run test:security:build
npm run security:dependencies
npm run security:secrets
```

La instalación verificada se ejecutó en una copia temporal: npm ci sin scripts, lockfile intacto, sharp procesando WebP y build Turbopack. La suite de seguridad compila Webpack/arranca HTTP en otra copia sin dotenv; no necesita credenciales reales. Las pruebas y typecheck usan process.execPath y variables permitidas, no heredan Graph/Auth/DB reales.

Para SQL, inicializá un clúster **nuevo** PostgreSQL 18.7, usuario ficticio asvo_ci, puerto libre, bind 127.0.0.1 y socket/PGDATA temporales. En esta ejecución se usó 55487, auth trust exclusivamente en el clúster temporal loopback, sin compartir un servidor de aplicación. El administrador se usa solo para consultar versión y crear/eliminar bases reservadas. No usar .env.local ni .env.production.local para este recorrido:

```sh
# Sustituir /ruta/runtime/bin por el bin aislado Node/npm y el puerto si corresponde.
env -i PATH=/ruta/runtime/bin:/usr/bin:/bin \
  CI_DATABASE_URL=postgres://asvo_ci@127.0.0.1:55487/postgres \
  npm run test:integration:ci
```

El runner rechaza destinos no loopback, bases no administrativas y credenciales heredadas de proveedores; consulta server_version_num y exige 180007 **antes de crear bases**. Sin dotenv. Cada grupo crea y retira su DB ficticia, incluidos los subcasos de migraciones. Graph se simula; no hubo correo ni cargas reales. Al finalizar, detener pg_ctl y retirar PGDATA, binarios, copias y fuentes temporales de esta ejecución; conservar el entorno persistente anterior intacto.

## Resultados

| Comprobación ejecutada | Resultado |
| --- | --- |
| Versiones efectivas | Node principal/hijo absoluto/hijo PATH 26.13.1; npm 11.7.0; SQL 18.7 / 180007. |
| Instalación limpia / nativos | npm ci sin scripts, lockfile intacto, sharp WebP y Turbopack correctos. |
| Tipos y calidad | next typegen + TypeScript en copia limpia; lint 320 archivos; formato del alcance CI. |
| Unitarias / navegación aislada | 92 pruebas, sin DB/red/credenciales. No son navegador visual. |
| Cobertura declarada | 35 módulos; líneas 1149/1149 (100 %), ramas 1223/1267 (96,53 %), funciones 213/214 (99,53 %). [Detalle por módulo](cobertura-unitaria-node26.json). No cobertura global. |
| Contratos | Cinco inventarios/contratos correctos. |
| CI | Siete controles correctos, incluido runtime efectivo y conservación de workflow manual/sin engines. |
| SQL / integración | 18 grupos completos: migración vacía/adopción compatible e incompatible/checksum/repetición/fallo/concurrencia; seguridad, permisos, enlaces, estados, cupos/espera, auditoría, formularios, navegación desde acciones, fotos y outbox. |
| Fallos externos | Rechazo/timeout/resultado incierto de correo; reserva concurrente, deduplicación, .test; autorización antes de bytes, conflicto de fotos y compensación. Todo con dobles. |
| Build/arranque | Turbopack y Webpack; HTTP local, headers, Auth.js providers, cron sin autorización y rechazo server-only al cliente. Sin marcadores de efectos implícitos. |
| Auditoría | npm: cero avisos reportados; Secretlint: cero hallazgos/fallos sobre archivos publicables e historial local disponible; informes saneados en coverage ignorado. No implica ausencia universal de vulnerabilidades/secretos. |

La ausencia de efectos se comprobó en los caminos ejercitados mediante guards y pruebas de preparación/migraciones. No demuestra todos los caminos posibles ni entrega real de correo. No hay migraciones nuevas ni cambios funcionales a los flujos ASVO.

## Pendientes separados

- Primera CI remota Ubuntu/contenedor 18.7 y revisión de seguridad de la imagen, con autorización posterior. Mantener workflow_dispatch; no activar PR/push ni required checks aquí.
- Matriz visual CUA desktop/celular, foco, archivos, lectores reales y dispositivos. Suite y evidencias anteriores conservadas; no se ejecutó una nueva matriz visual.
- Parche efectivo de funciones Vercel, integración de proveedores y privilegios reales: no consultados en esta tarea.
- Publicación futura explícita; estos archivos permanecen locales.
