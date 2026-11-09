# Coordinación de Voluntariado de ASVO

Primera entrega local con datos ficticios. El orden de trabajo es registro y permisos, convocatoria fija, verificación y cupos, luego fechas flexibles y comunicado. El segundo hito incorpora logística privada, 70, informes y cierre.

## Arquitectura

Next.js App Router y PostgreSQL. Las mutaciones pasan por acciones de servidor y las asignaciones se serializan por convocatoria. Para el piloto, Auth.js con Microsoft Entra ID de un solo directorio y permisos operativos en PostgreSQL vinculados al identificador del objeto Entra. Vercel ejecutará Node.js y usará una URL de PostgreSQL con pooling. Exchange Online será el transporte de correo mediante Graph. Los futuros archivos se guardarán en la biblioteca privada de SharePoint y se referenciarán por identificadores de sitio, unidad y elemento. Cada descarga requerirá autorización en el servidor.

El módulo futuro de capacitaciones vinculará cada curso completado al UUID de la persona y a un catálogo. Guardará fecha, entidad, evidencia en SharePoint, verificador y vigencia. SCI y CBF de BRIF son ejemplos pendientes de confirmar con las unidades.

## Decisiones del piloto

- Definir proveedor PostgreSQL, copias de seguridad y prueba de restauración, retención y exportaciones.
- Confirmar objeto Entra de la primera cuenta administradora, cuentas autorizables, buzón y permisos Graph.
- Confirmar vencimiento y datos accesibles para el 70, relevos y permisos de las administraciones de estación.
- Confirmar regla de traslape, cupo diario o por salida, cómputo de cancelación y excepciones de póliza.
- Revisar muestras anonimizadas del registro, Polizas y fuente de vigencias. Nombre Completo BD será derivado. Column 13 queda pendiente.

## Despliegue local

Ejecutá estos comandos desde la carpeta `coordinacion-asvo`. Requiere Node.js 22 o posterior y npm. El entorno de prueba funciona con `ASVO_DEMO=1` y `npm run dev`.

### Primera instalación en Mac con Apple Silicon

Instalá las dependencias y PostgreSQL dentro del proyecto:

```sh
npm ci
npm install --prefix .local-postgres/runtime --no-save --package-lock=false @embedded-postgres/darwin-arm64@18.6.0-beta.19
```

Si todavía no existe `.env.local`, crealo:

```sh
cp .env.example .env.local
```

Si ya existe, editá el archivo conservando su configuración. Para la instalación persistente y el puerto 3031, usá:

```dotenv
DATABASE_URL=postgres://asvo:asvo@127.0.0.1:55431/postgres
APP_URL=http://localhost:3031
ASVO_DEMO=1
```

Iniciá PostgreSQL y aplicá el esquema:

```sh
npm run db:start
npm run db:setup -- --demo
```

`db:start` inicializa la base en el primer uso y detecta si ya está activa. Los datos quedan en `.local-postgres/data/` y el registro del servidor en `.local-postgres/postgres.log`. Conservá esa carpeta entre sesiones. Una instalación en `/private/tmp` puede desaparecer después de reiniciar el equipo.

### Datos de prueba

Prepará el registro ficticio, sus pólizas de prueba y los permisos de administrador y Coordinación general:

```sh
node --env-file=.env.local scripts/demo-registro.mjs
```

Podés cargar además el calendario de noviembre de 2026 y el ejemplo de agrupaciones flexibles:

```sh
node --env-file=.env.local scripts/demo-calendario-noviembre.mjs
node --env-file=.env.local scripts/demo-agrupaciones.mjs
```

Estos scripts requieren una base demo local y pueden repetirse sin duplicar los ejemplos identificados. El calendario también actualiza los bloques coincidentes de Robles-Kaufman. Las fechas y las vigencias de las pólizas están fijadas en los scripts. Las convocatorias vencidas siguen visibles en Coordinación y dejan de aparecer en el catálogo público.

### Iniciar la aplicación

```sh
npm run dev -- --port 3031
```

Abrí [Convocatorias](http://localhost:3031/) o [Coordinación](http://localhost:3031/coordinacion). En Coordinación podés usar **Entrar como coordinación** o **Entrar como administrador**. El script `demo-registro.mjs` asigna los permisos a ambas cuentas.

Para probar una inscripción:

1. Abrí una convocatoria vigente en una ventana privada. Usá una identificación de `scripts/registro-ficticio.csv`, como `DEMO0001`. La póliza ficticia debe cubrir las fechas elegidas.
2. La inscripción queda **En revisión** y reserva cupo si hay disponibilidad. Si los cupos están cubiertos, queda en **Lista de espera**.
3. En la sesión de Coordinación abrí **Bandeja de prueba · Demo**. El mensaje muestra el estado y el enlace privado para consultar, editar o cancelar la inscripción. Abrí ese enlace en la ventana privada.
4. Coordinación puede confirmar sin motivo. Mover a espera, rechazar o cancelar requieren justificación. Al liberar un cupo, la siguiente solicitud en espera pasa a revisión y recibe un aviso. La persona movida manualmente a espera queda excluida de esa promoción inmediata.

### Volver a iniciar después de reiniciar el equipo

```sh
npm run db:start
npm run dev -- --port 3031
```

El esquema y los ejemplos se conservan. Cuando una actualización agregue tablas o columnas, ejecutá `npm run db:setup` con PostgreSQL activo.

Para detener Next.js, pulsá **Ctrl+C** en su terminal. Para detener también PostgreSQL:

```sh
.local-postgres/runtime/node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl -D .local-postgres/data -m fast stop
```

### Alternativa con Docker u otro PostgreSQL

Si elegís Docker Desktop, iniciá Docker antes de ejecutar:

```sh
docker compose up -d
```

El archivo `docker-compose.yml` usa PostgreSQL en `127.0.0.1:5432`, usuario y contraseña `asvo`, base `asvo` y volumen persistente `asvo-data`. Configurá:

```dotenv
DATABASE_URL=postgres://asvo:asvo@127.0.0.1:5432/asvo
APP_URL=http://localhost:3031
ASVO_DEMO=1
```

Después ejecutá `npm run db:setup -- --demo`, cargá los ejemplos necesarios y levantá Next.js. Si ya tenés PostgreSQL 17 o posterior, configurá `DATABASE_URL` con una base dedicada a pruebas y aplicá el mismo esquema. El comando `db:start` corresponde a la instalación integrada para Mac con Apple Silicon.

### Problemas habituales

| Mensaje o situación | Cómo continuar |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:55431` | Ejecutá `npm run db:start`. Si falla, revisá `.local-postgres/postgres.log` y el puerto de `DATABASE_URL`. |
| `command not found: docker` | Usá la instalación persistente para Mac indicada arriba, o instalá e iniciá Docker Desktop si elegís esa alternativa. |
| Puerto 3031 ocupado | Elegí otro con `npm run dev -- --port PUERTO` y actualizá `APP_URL` para que coincida. |
| Catálogo sin convocatorias | Revisá que las salidas estén abiertas, sean públicas y tengan inscripción vigente. |
| Faltan tablas o columnas | Ejecutá `npm run db:setup` con PostgreSQL activo. |
| Desapareció la base de `/private/tmp` | Restaurá un respaldo o reconstruí los ejemplos con los scripts. Los cambios manuales requieren un respaldo para recuperarse. |

### Verificación y acceso institucional

`npm run check` verifica TypeScript y `npm run build` compila la aplicación. Las identidades ficticias y la bandeja de prueba funcionan en desarrollo. Para Entra, configurá un registro de aplicación de un solo directorio, el callback `/api/auth/callback/microsoft-entra-id` y su emisor. Aprovisioná el identificador de objeto aprobado con rol `admin` y configurá Graph para el buzón y la biblioteca de SharePoint autorizados.

## Correos de inscripción

Cada recepción y actualización genera un correo con estado, mensaje y enlace privado. En modo demo se consulta en **Bandeja de prueba · Demo**. En producción se usa Exchange Online mediante Graph. Los mensajes quedan en una cola persistente dentro de la misma transacción que cambia la inscripción.

La aplicación intenta enviarlos después de cada operación. Si falla Graph, quedan pendientes de reintento. Para procesar la cola cada minuto, mantené un proceso de correo activo con `npm run mail:worker`, usando las variables de entorno del despliegue. En un servicio que ya inyecta las variables, usá `node scripts/mail-outbox.mjs --watch`. En Vercel, un proceso permanente necesita un servicio aparte o una ejecución programada que invoque `node scripts/mail-outbox.mjs`. Para un reintento local puntual, usá `npm run mail:retry`. Los mensajes de una misma inscripción se entregan en orden. Una interrupción después de la aceptación por Graph y antes de registrar el envío puede producir un correo duplicado.

`npm run db:setup` adapta las solicitudes existentes al nuevo reparto por orden de recepción, conserva las confirmaciones y genera sus avisos una sola vez. La prueba local `npm run test:registration` comprueba concurrencia, reservas, promociones, motivos, correos demo y enlaces privados, y elimina sus propios datos al terminar. Requiere Node.js 22.18 o posterior con soporte de TypeScript nativo.

## Criterios provisionales y alcance

El cupo se cuenta por salida. Las solicitudes en revisión y confirmadas ocupan cupo. Las solicitudes en espera, rechazadas o canceladas quedan fuera del contador. Las sugerencias enlazan periodos inclusivos por cadena de traslapes. El registro de decisiones de agrupación guarda una nota auditada. La advertencia de cancelación usa horas hacia atrás desde la medianoche de la fecha de llegada solicitada en Costa Rica. Una póliza solo habilita confirmación si su verificación cubre ambas fechas. Los enlaces de gestión duran al menos 72 horas y permanecen vigentes hasta siete días después del fin de participación o de la salida, lo que sea posterior.

La importación inicial usa CSV de identidad básica. La ficha tiene campos adicionales para ampliar el mapeo con la muestra de ASVO. La hoja Polizas se concilia a partir de un CSV con encabezados provisionales. Los grupos pueden separarse en salidas propias. Si una persona cambia las fechas de una inscripción confirmada, vuelve a revisión y conserva su reserva. SharePoint, 70, gastos, informes y cierres corresponden al segundo hito.

## Identidad visual

La interfaz usa la paleta principal ASVO del libro de marca, página 1. Los colores se centralizan en `app/style.css`. El logotipo, la fotografía de portada y el tratamiento tipográfico toman como referencia el portal de pólizas. El gris verdoso de superficies secundarias es una adaptación de interfaz.

## Fotos de convocatorias

Si ya tenés una base local, ejecutá `npm run db:setup` para agregar la tabla de fotos. En Coordinación, abrí una salida y buscá **Fotos de la convocatoria**. Adjuntá entre una y seis fotos autorizadas para publicación, una por vez. Se aceptan JPG, PNG y WebP de hasta 3 MB por archivo. La primera es la portada. Podés cambiarla, ordenar las fotos o retirarlas desde la misma sección.

El modo de prueba conserva en PostgreSQL las versiones WebP para tarjeta y ficha. Fuera de ese modo, configurá `SHAREPOINT_PHOTO_DRIVE_ID` y `SHAREPOINT_PHOTO_FOLDER_ID` junto con las credenciales Graph. La identidad de Graph necesita permiso de escritura en la carpeta privada asignada. El portal entrega las versiones optimizadas de las fotos vigentes de convocatorias abiertas. Retirar una foto la oculta del portal y conserva el original en SharePoint. Las convocatorias que ya estaban abiertas siguen disponibles y pueden recibir su portada desde Coordinación.
