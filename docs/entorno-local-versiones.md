# Entorno persistente local alineado

17/11/2026, macOS Apple Silicon. Sin cambios de Vercel/Neon, publicación ni GitHub.

| Herramienta | Antes, entorno efectivo | Ahora, entorno del proyecto |
| --- | --- | --- |
| Node.js | 25.2.1 de Homebrew | 26.13.1 en `.local-runtime/node` |
| npm | El runtime oficial Node descargado incluía 11.20.0 | 11.7.0, instalado explícitamente en ese prefijo local |
| PostgreSQL servidor | 18.6 embedded, puerto 55431 | 18.7 compilado, mismo clúster/puerto/usuario/base |

Los pines `.node-version`, `packageManager` y `scripts/ci/runtime.json` ya eran correctos. Faltaba instalar/seleccionar esas versiones de manera persistente; cambiar el texto de `.env.local` no selecciona Node ni PostgreSQL.

## Uso cotidiano

En esta Mac, `~/.zshrc` ahora activa el entorno al entrar al proyecto o sus subcarpetas, y restaura el PATH previo al salir. También lo activa en una terminal nueva abierta directamente dentro del proyecto. Para cargar el hook en una terminal que ya estaba abierta, ejecutá `source ~/.zshrc` una vez.

La activación manual sigue disponible para otras instalaciones o shells sin ese hook:

```sh
source scripts/local-env.zsh
node scripts/ci/check-runtime.mjs
npm run db:start
npm run dev -- --port 3031
```

Si Next ya está abierto, detenelo con Ctrl+C en su terminal antes de volverlo a iniciar. Un proceso que ya estaba ejecutándose no cambia de Node al modificar PATH. La instalación global del Mac no se reemplazó; fuera del proyecto la terminal conserva su PATH anterior y puede mostrar Node 25.2.1. El hook solo cambia PATH, no inicia PostgreSQL/Next ni carga `.env`.

El activador verifica las tres versiones antes de modificar PATH. Incluye el Node de los procesos hijos y npm; no carga dotenv, secretos ni preferencias globales. `db:start` usa el binario 18.7, comprueba versión/directorio del servidor y rechaza un runtime faltante o un destino demo no local. Los fixtures visuales de registro, convocatorias e inscripciones ahora seleccionan el mismo runtime 18.7. Sus capturas y resultados anteriores **siguen siendo evidencia histórica sobre 18.6**; no se reetiquetaron como nuevas pruebas de navegador.

Detener PostgreSQL:

```sh
.local-postgres/runtime-18.7/bin/pg_ctl -D .local-postgres/data -m fast stop
```

## Instalación en otra Mac

Los binarios, descargas y datos están ignorados por Git. Clonar el proyecto no los instala. Alternativamente podés seleccionar las mismas versiones con un gestor de runtimes, usando PostgreSQL 18.7 y configurando una base demo dedicada; `db:start` está preparado específicamente para el prefijo local indicado.

Distribuciones verificadas:

- [Node oficial 26.13.1](https://nodejs.org/download/release/v26.13.1/): `node-v26.13.1-darwin-arm64.tar.gz`, SHA256 `aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735`.
- [PostgreSQL oficial 18.7](https://ftp.postgresql.org/pub/source/v18.7/): `postgresql-18.7.tar.bz2`, SHA256 `441dfae4280cae3e0425e5f876f80559fb0731c140f1aae22b3e5a54d0411bfd`. Se cotejó además el archivo oficial `.sha256` descargado.

Para una instalación nueva, extraé Node en `.local-runtime/node`, conservando su árbol `bin/lib/include`. Después instalá el npm fijado **solo en ese prefijo**:

```sh
.local-runtime/node/bin/node .local-runtime/node/lib/node_modules/npm/bin/npm-cli.js \
  install --global --prefix "$PWD/.local-runtime/node" npm@11.7.0 \
  --ignore-scripts --no-audit --no-fund
```

`--global` aquí se limita al prefijo explícito del proyecto; no instala en Homebrew ni en el perfil del usuario. Usá el manifiesto oficial para verificar el SHA256 antes de ejecutar el binario descargado.

PostgreSQL requiere las herramientas de línea de comandos de Xcode y `make`. Después de descargar/verificar su archivo, desde la raíz del proyecto:

```sh
ASVO_PROJECT="$PWD"
ASVO_PG_BUILD="$(mktemp -d /tmp/asvo-pg18-build.XXXXXX)"
tar -xjf .local-runtime/downloads/postgresql-18.7.tar.bz2 -C "$ASVO_PG_BUILD"
(
  cd "$ASVO_PG_BUILD/postgresql-18.7"
  ./configure --prefix="$ASVO_PROJECT/.local-postgres/runtime-18.7" \
    --without-readline --without-zlib --without-icu
  make -j 4
  make install
)
```

Esta compilación local mínima no reproduce las extensiones, ICU, SSL ni distribución del proveedor. El clúster existente usa locale C, proveedor libc y extensión plpgsql: compatible con este runtime. Se conservó el clúster; no hubo migración de esquema ni carga demo implícita. Para bases que requieran otras extensiones/opciones, revisá compatibilidad antes de reemplazar binarios.

No ejecutes configure desde la raíz del repositorio: el subdirectorio de compilación es temporal. Si ya existe `.local-postgres/data`, no borres ni vuelvas a inicializarlo. Un cambio mayor de PostgreSQL requiere un procedimiento separado; esta actualización fue **18.6 → 18.7**.

## Respaldo y recuperación

Antes de detener 18.6 se creó un dump sin compresión con el cliente 18.7; después de detenerlo se copió íntegramente el directorio de datos. Ambos permanecen bajo:

`.local-postgres/backups/2026-11-17T20-18-54-302Z/`

Contiene `postgres.dump`, `data-18.6/` y `before-counts.json`. Carpeta privada y dump con permisos restrictivos, excluidos de Git. Puede contener datos sensibles del entorno local: no adjuntarlo a issues ni publicarlo. No se eliminó el runtime embedded anterior.

La comprobación posterior encontró PostgreSQL 18.7 y conteos idénticos en las **28 tablas públicas**. No es una comprobación bit a bit de todas las filas; el respaldo físico conserva el estado previo para recuperación. El recibo saneado queda en `.local-runtime/local-runtime-verification.json`.

Si hiciera falta recuperar, primero detener el servidor, conservar aparte el directorio actual y restaurar la copia física **a otra ubicación** con el runtime 18.6 correspondiente, o restaurar el dump en un clúster nuevo. No sobrescribir el clúster activo ni revertir binarios sobre datos modificados suponiendo que es automático. Esta tarea no ejecutó una restauración de recuperación.

## Docker y comprobaciones

Compose ahora declara `postgres:18.7`, volumen nuevo `asvo-data-pg18` montado en `/var/lib/postgresql`. El volumen antiguo `asvo-data` de PostgreSQL 17 se conserva y no se monta sobre 18. Docker no está instalado en esta Mac: no se ejecutó ni migró ese volumen. Su instalación/migración es alternativa al entorno nativo, no parte del cambio realizado.

Verificación local ejecutada:

- Node principal, hijo absoluto y por PATH: 26.13.1; npm 11.7.0.
- `postgres --version` y consulta del servidor: PostgreSQL 18.7.
- `db:start` detecta el servidor local y confirma versión/directorio.
- 108 pruebas unitarias, ocho controles CI y contratos correctos; TypeScript/Next typegen en copia limpia, lint y sintaxis de scripts/fixtures correctos.
- Runner de integración con comprobación previa **18.7/180007**: **24 grupos correctos**. Crea/retira bases ficticias, sin modificar las tablas del clúster de aplicación; Graph/correo simulados. Registro local ignorado `.local-runtime/integration-18.7.log`.

Se retiraron fuentes de compilación y ayudantes temporales; se conservan runtimes, respaldo y recibo local. No se ejecutó nueva matriz CUA, build ni CI remota por este cambio operativo. Se conservan las evidencias previas con sus versiones originales. Próximos recorridos visuales ya pueden usar el runtime local 18.7; lectores, dispositivos físicos e infraestructura siguen como pendientes independientes.

## Activación automática zsh — 17/11/2026

Se agregó un bloque delimitado ASVO a `/Users/alvaroalpizar/.zshrc`, con un único hook chpwd. No existía ese archivo: el respaldo `/Users/alvaroalpizar/.zshrc.backup-asvo-20261117-144434-396723` conserva el estado previo vacío; el recibo local registra esa ausencia. La configuración es local a esta Mac y no se incluye al clonar el repositorio.

Verificado con zsh real: entrar/salir/reentrar, subcarpetas, recargar el perfil sin duplicar el hook, subshell con restauración independiente y arranque interactivo dentro del proyecto. El PATH previo se conserva en variables de sesión heredables; no se escribe en archivos ni incluye credenciales. La restauración es exacta: cambios manuales de PATH hechos dentro del proyecto también se descartan al salir. No se modificaron alias, proveedores, bases ni workflows.

Para desinstalar, quitar únicamente el bloque entre `# >>> ASVO coordinacion-asvo: entorno local automatico >>>` y su cierre correspondiente, y abrir una terminal nueva. No sobrescribir cambios posteriores del perfil con el respaldo sin revisarlos.
