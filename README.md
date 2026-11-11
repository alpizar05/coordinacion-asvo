# Coordinación de Voluntariado de ASVO

Plataforma de coordinación e inscripción de voluntariado. La beta está desplegada en [coordinacion-asvo.vercel.app](https://coordinacion-asvo.vercel.app), con autenticación institucional, PostgreSQL en Neon, fotos en SharePoint y correo mediante Exchange Online.

## Migración histórica de la beta

La [guía de migración histórica 2026](docs/migracion-historica-2026.md) documenta el contrato de importación, los supuestos del demo, los informes pendientes, la asignación de portadas y las comprobaciones de integridad. Los archivos de datos originales se mantienen privados y fuera del repositorio.

## Manual de despliegue y configuración

Las recomendaciones de producto y experiencia de uso están en la **[lista de mejoras pendientes](TODO.md)**, ordenadas por prioridad.

Consultá el **[How to: desplegar y configurar la plataforma](docs/despliegue-y-configuracion.md)**. Incluye GitHub, Vercel, Neon, Entra ID, SharePoint, Microsoft Graph, Exchange Online, PowerShell, variables de entorno, permisos, diagnóstico de errores y el procedimiento futuro para dominio y remitente definitivo.

El manual también registra qué se verificó en la beta y los pendientes: reintentos programados de correo, pruebas de aceptación, separación de bases por entorno y preparación del lanzamiento. El subdominio `voluntariado.asvocr.org` queda reservado para esa etapa.

## Arquitectura

Next.js App Router y PostgreSQL. Las mutaciones pasan por acciones de servidor y las asignaciones se serializan por convocatoria. Auth.js usa Microsoft Entra ID de un solo directorio y permisos operativos en PostgreSQL vinculados al identificador del objeto del usuario. Vercel ejecuta Node.js y se conecta a Neon. Exchange Online transporta el correo mediante Graph con autorización limitada al buzón de beta. Los originales de fotos se guardan en una biblioteca privada de SharePoint; PostgreSQL conserva sus referencias y las versiones optimizadas que entrega la aplicación.

El módulo futuro de capacitaciones vinculará cada curso completado al UUID de la persona y a un catálogo. Guardará fecha, entidad, evidencia en SharePoint, verificador y vigencia. SCI y CBF de BRIF son ejemplos pendientes de confirmar con las unidades.

## Decisiones del piloto

- Definir copias de seguridad, prueba de restauración, retención y exportaciones de Neon, y separar Preview de Production.
- Preparar dominio y buzón definitivos para lanzamiento; el acceso institucional y el buzón de beta ya están configurados.
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

Los mensajes nuevos usan una plantilla HTML con el logo de ASVO, los colores de la plataforma, saludo por nombre, estado, detalles de participación y botón **Ver mi inscripción**. El texto se adapta a revisión, espera, confirmación, rechazo y cancelación. Los correos de cancelación conservan estado y motivo, pero no incluyen botón ni enlace privado y no generan un nuevo enlace de gestión. El logo usa la URL pública de `APP_URL`; algunos clientes pueden bloquear imágenes externas, por lo que se incluye texto alternativo. La cola conserva también el texto plano y los mensajes anteriores siguen enviándose como texto. Aplicá el esquema antes de desplegar esta versión para agregar `registration_mail_outbox.html_body`. La bandeja demo sigue mostrando la versión de texto. Verificá la plantilla con `node scripts/test-mail-template.mjs`.

Cada recepción y actualización genera un correo con estado, mensaje y enlace privado. En modo demo se consulta en **Bandeja de prueba · Demo**. En producción se usa Exchange Online mediante Graph. Los mensajes quedan en una cola persistente dentro de la misma transacción que cambia la inscripción.

La aplicación intenta enviarlos después de cada operación. Si falla Graph, quedan pendientes de reintento. Para procesar la cola cada minuto, mantené un proceso de correo activo con `npm run mail:worker`, usando las variables de entorno del despliegue. En un servicio que ya inyecta las variables, usá `node scripts/mail-outbox.mjs --watch`. En Vercel, `vercel.json` programa `/api/cron/correos` diariamente a las 12:00 UTC (6:00 a. m. de Costa Rica), compatible con Hobby. Para activarlo, configurá `CRON_SECRET` en Production y desplegá el código. La ruta exige autorización Bearer y rechaza demo/Preview. Consultá la [configuración y verificación del cron](docs/despliegue-y-configuracion.md#10-cola-y-reintentos-de-correo). La ejecución diaria es de respaldo; un envío fallido puede esperar al siguiente día. Para un reintento local puntual, usá `npm run mail:retry`. Los mensajes de una misma inscripción se entregan en orden. Una interrupción después de la aceptación por Graph y antes de registrar el envío puede producir un correo duplicado.

`npm run db:setup` adapta las solicitudes existentes al nuevo reparto por orden de recepción, conserva las confirmaciones y genera sus avisos una sola vez. La prueba local `npm run test:registration` comprueba concurrencia, reservas, promociones, motivos, correos demo y enlaces privados, y elimina sus propios datos al terminar. Requiere Node.js 22.18 o posterior con soporte de TypeScript nativo.

Cuando una persona cancela su inscripción desde el enlace privado, se encola un aviso al buzón `GRAPH_SENDER` (el mismo remitente configurado; en beta, el buzón de Coordinación de pruebas). Incluye persona, salida, fechas, motivo y enlace institucional que exige iniciar sesión. El aviso usa la cola persistente y sus reintentos. La persona recibe su cancelación sin enlace privado.

Coordinación puede confirmar una inscripción cancelada desde **Gestionar → Confirmar cupo**. Se vuelven a revisar póliza, unidad, duplicados y disponibilidad, respetando la lista de espera existente. La salida debe estar abierta o confirmada; no se reactivan inscripciones rechazadas por esta vía. La operación se audita y envía una nueva confirmación a la persona con enlace privado; no recupera automáticamente una asignación anterior de 70.

## Criterios provisionales y alcance

El cupo se cuenta por salida. Las solicitudes en revisión y confirmadas ocupan cupo. Las solicitudes en espera, rechazadas o canceladas quedan fuera del contador. Las sugerencias enlazan periodos inclusivos por cadena de traslapes. El registro de decisiones de agrupación guarda una nota auditada. La advertencia de cancelación usa horas hacia atrás desde la medianoche de la fecha de llegada solicitada en Costa Rica. Una póliza solo habilita confirmación si su verificación cubre ambas fechas. Los enlaces de gestión duran al menos 72 horas y permanecen vigentes hasta siete días después del fin de participación o de la salida, lo que sea posterior.

La importación inicial usa CSV de identidad básica. La ficha tiene campos adicionales para ampliar el mapeo con la muestra de ASVO. La hoja Polizas se concilia a partir de un CSV con encabezados provisionales. Los grupos pueden separarse en salidas propias. Si una persona cambia las fechas de una inscripción confirmada, vuelve a revisión y conserva su reserva. La plataforma incluye fotos en SharePoint, asignación del 70, resumen privado e informe de salida; las pruebas de aceptación pendientes se registran en el manual.

## Identidad visual

La interfaz usa la paleta principal ASVO del libro de marca, página 1. Los colores se centralizan en `app/style.css`. El logotipo, la fotografía de portada y el tratamiento tipográfico toman como referencia el portal de pólizas. El gris verdoso de superficies secundarias es una adaptación de interfaz.

## Administración

La pestaña **Administración** (`/coordinacion/administracion`) aparece únicamente para usuarios con rol `admin` y concentra accesos del personal, importación del registro y conciliación de pólizas. Está separada de Convocatorias de salida y Voluntariado. Las cuentas solo administradoras se redirigen allí desde `/coordinacion`; las que también coordinan conservan ambas opciones de navegación.

## Modales de Coordinación

Actualizar unidades, Corregir ficha, Verificar póliza y Crear salida para un grupo usan modales en desktop y celular, con Cancelar y Guardar, confirmación al descartar cambios y conservación de datos ante errores. Corregir ficha agrupa identidad/contacto, ubicación, emergencia y trayectoria. Los permisos se verifican en el servidor. Transporte, restricciones, informes y solicitud de apoyo conservan el desplegable en desktop y el modal en celular; los filtros y acciones de tablas mantienen su presentación por dispositivo.

## Fotos de convocatorias

Si ya tenés una base local, ejecutá `npm run db:setup` para agregar la tabla de fotos. En Coordinación, abrí una salida y buscá **Fotos de la convocatoria**. Pulsá **Agregar foto** para abrir el mismo modal en desktop y celular: elegí Galería o Subir nueva, revisá la miniatura y completá descripción y crédito. Al agregarse correctamente se cierra; si falla conserva la selección y los datos. **Editar foto** reutiliza ese modal para corregir los datos. En una convocatoria nueva las fotos quedan seleccionadas en el formulario hasta publicar; en una existente se guardan al agregarlas. Los cambios de descripción y crédito de una copia de galería no modifican su origen. Adjuntá entre una y seis fotos autorizadas para publicación, una por vez. Se aceptan JPG, PNG y WebP de hasta 3 MB por archivo. La primera es la portada. Podés cambiarla, ordenar las fotos o retirarlas desde la misma sección.

El modo de prueba conserva en PostgreSQL las versiones WebP para tarjeta y ficha. Fuera de ese modo, configurá `SHAREPOINT_PHOTO_DRIVE_ID` y `SHAREPOINT_PHOTO_FOLDER_ID` junto con las credenciales Graph. La identidad de Graph necesita permiso de escritura en la carpeta privada asignada. El portal entrega las versiones optimizadas de las fotos vigentes de convocatorias abiertas. Retirar una foto la oculta del portal y conserva el original en SharePoint. Las convocatorias que ya estaban abiertas siguen disponibles y pueden recibir su portada desde Coordinación.

### Agregar inscripciones desde Coordinación

En el detalle de una salida abierta o confirmada, elegí **Inscripciones → Agregar persona**. Buscá por nombre, identificación o correo, seleccioná la persona y completá sus fechas y logística. Las fechas se precargan con el periodo de la salida y se pueden ajustar cuando es flexible.

La incorporación verifica unidad, correo, póliza vigente para todo el periodo y ausencia de otra inscripción activa. Se registra en revisión cuando hay cupo o en lista de espera cuando está completo, respetando el orden de recepción. Se envía el correo habitual con el enlace privado y se registra al coordinador responsable. La confirmación posterior se realiza desde **Gestionar**. Coordinación puede incorporar personas después de la fecha límite pública mientras la salida esté abierta o confirmada.

### Editar una inscripción desde Coordinación

En **Gestionar → Editar inscripción**, abrí el modal para modificar fechas y datos de transporte, alimentación, interés en ser 70 y observaciones. Disponible en el detalle de la salida y en Solicitudes de inscripción para registros en revisión, espera o confirmados de salidas abiertas o confirmadas. La identidad y el estado se gestionan por separado.

Si cambian las fechas de una inscripción confirmada, conserva su cupo y vuelve a revisión; se retira la asignación de 70 y se revoca su enlace de resumen hasta que se vuelva a confirmar y asignar. La edición verifica unidad y cobertura de póliza, conserva el orden en lista de espera, registra al coordinador y notifica por correo. No permite sobrescribir una inscripción modificada mientras el modal estaba abierto.

### Resumen de Coordinación

`/coordinacion` es la entrada principal para personas con permisos de coordinación. **Convocatorias de salida** se encuentra en `/coordinacion/convocatorias`; Administración conserva su acceso independiente.

Resumen reúne **Requiere atención** (inscripciones en revisión, próximas salidas sin 70 e informes pendientes) y **Próximas salidas**. Las acciones de inscripción regresan al dashboard conservando filtros. El filtro por unidad respeta los permisos; el periodo de 7, 14 o 30 días afecta las salidas próximas y sin 70. Las revisiones y los informes incluyen todos los pendientes, con hasta 100 registros visibles por categoría y conteo total. La pestaña inicial prioriza salidas que comienzan hoy/mañana y luego informes; si hay preferencias guardadas, se restaura la selección del coordinador.

Los informes se consideran pendientes desde el día siguiente al final de la salida, sin calificarlos como atrasados: se espera un informe por cada 70 confirmado asignado, conforme al modelo actual. Las salidas finalizadas sin 70 ni informes señalan que falta definir responsable. Se excluyen canceladas y borradores. Las preferencias de unidad, periodo y pestaña se guardan en este navegador por usuario, sin almacenar datos de voluntariado.

Prueba local del dashboard: `node --env-file=.env.local scripts/test-coordination-summary.mjs`. Usa registros temporales y verifica permisos, periodos, estados, asignación de 70 e informes.

### Seguimiento de informes y recordatorios

En **Resumen → Informes pendientes** se muestran los 70 confirmados de cada salida, quién presentó el informe, vigencia del enlace y último recordatorio (fecha, identificador del coordinador y estado enviado/pendiente/cancelado). Las salidas sin responsable se distinguen y no ofrecen envío. **Enviar recordatorio** abre un modal con destinatario, asunto y mensaje para revisión; no envía nada hasta confirmar.

La cola habitual registra los correos y reintenta los fallidos. No se permite otro recordatorio mientras uno esté pendiente. Antes del envío se comprueba que la salida terminó, el 70 y su correo continúan vigentes, el enlace sigue habilitado y el informe no se presentó. Si dejó de corresponder, el correo se marca cancelado sin enviarlo. Un recordatorio posterior puede reutilizar un enlace recuperable con más de un día de vigencia; de lo contrario crea uno de siete días sin revocar otros enlaces válidos. En demo se registra en Bandeja de prueba, sin enviar correos reales.

**Antes de desplegar esta versión:** aplicar `schema.sql` con `node --env-file=.env.production.local scripts/db.mjs`. Agrega `report_reminders` y `registration_mail_outbox.cancelled_at`; es una migración aditiva. La base local ya se actualizó. No se actualiza Neon automáticamente desde la aplicación.

### Borrador y finalización del informe del 70

**Guardar borrador** conserva campos incompletos y la selección provisional de asistentes para retomarlos con un enlace privado vigente. No confirma asistencia ni completa la tarea: el dashboard y los recordatorios siguen considerando pendiente el informe. **Finalizar informe** exige todos los campos obligatorios y la confirmación de asistencia, registra la fecha definitiva y bloquea futuras ediciones, incluso desde pestañas antiguas o con `?editar=1`. En la guía del 70 aparece «Continuar borrador» o «Consultar informe», según el estado.

La migración de `schema.sql` incorpora `outing_reports.status` y permite fechas vacías solo durante el borrador. Los informes existentes se conservan como finalizados. Para aplicar esta actualización debe ejecutarse `node --env-file=.env.production.local scripts/db.mjs` en la base beta. Los informes previos a esta migración quedan finalizados y bloqueados para edición.

En el detalle de una salida terminada, **Inscripciones → Gestionar** ofrece **Recordar informe de salida** para una persona confirmada y asignada como 70 cuyo informe aún no esté finalizado. Reutiliza el modal y el envío de Resumen; bloquea duplicados cuando hay correo pendiente y muestra el acceso **Ver informe finalizado** cuando corresponde. Funciona también para salidas completadas sin habilitar la edición de inscripciones cerradas.

### Logística específica de cada bloque

Crear y editar una convocatoria incluye **Transporte**, **Alimentación** y **Hospedaje**: textos opcionales de hasta 5000 caracteres cada uno, públicos para las personas voluntarias. Se guardan por bloque y se copian al clonar o separar una agrupación. No se sobrescriben al editar datos comunes de la serie. La logística general existente se conserva como indicaciones adicionales.

Los campos se muestran en la convocatoria pública, en Logística e Información de Coordinación, en la guía privada del 70 y en el comunicado para WhatsApp. Las condiciones de la salida se distinguen de las ofertas de transporte y restricciones alimentarias personales. Los campos no completados indican «Por confirmar con Coordinación».

Esta versión agrega `outings.transport_details`, `food_details` y `lodging_details`. Antes de desplegar debe aplicarse `schema.sql` en Neon junto con la migración pendiente de borradores de informes.

### Historial de inscripción

**Gestionar → Ver inscripción** muestra el detalle y su historial desde la salida, Solicitudes de inscripción y Resumen. Está disponible también en registros cancelados y salidas cerradas, como consulta sin habilitar edición. Se carga al abrir el panel, verificando permisos de la unidad en el servidor.

La línea de tiempo reutiliza auditoría: fecha/hora de Costa Rica, responsable registrado, acción, motivo y cambios anteriores/nuevos para ediciones posteriores a esta versión. Los correos se presentan por separado con destinatario, fecha, estado pendiente/enviado/cancelado e intentos. «Enviado» significa aceptación de Microsoft, no lectura. El historial no devuelve cuerpos de correo, enlaces privados ni tokens.

Los datos antiguos no se reconstruyen por suposición. Los correos demo nuevos quedan vinculados por `demo_mail.registration_id` y `created_at`; los anteriores pueden no tener vínculo o fecha. Antes de desplegar aplicar `schema.sql` en Neon. La base local ya cuenta con las columnas y los índices de consulta.

### Trayectoria y participaciones de voluntariado

La ficha incluye salidas, fechas inscritas, estado de inscripción, asistencia según informes finalizados y responsabilidad como integrante o 70. Presenta totales por salida única: participación confirmada, salidas con informe finalizado como 70, informes pendientes a su cargo y última salida con participación acreditada. Los borradores no acreditan asistencia ni completan informes pendientes. Las asignaciones actuales de 70 se distinguen de responsabilidades documentadas en informes finalizados.

Si los informes discrepan para una misma persona y salida, se muestra «Asistencia por conciliar» y la salida se excluye del total acreditado. Varias inscripciones o informes coincidentes no duplican el conteo. Las fechas inscritas y publicadas no se presentan como fechas reales individuales ni se convierten en horas o días trabajados.

Coordinación general puede abrir la salida y consultar la inscripción e historial desde la ficha. Administración conserva la consulta de trayectoria sin enlaces a operaciones para las que no tenga permiso. La tabla se convierte en lista compacta en celular. La ausencia de registros históricos no equivale a ausencia de participación previa en ASVO. Esta función no requiere migración de base de datos.

Prueba local: `node --env-file=.env.local scripts/test-volunteer-participation.mjs`.

### Conciliación de asistencia

En **Salida → Herramientas → Asistencia**, Coordinación revisa los casos con informes finalizados contradictorios. El modal muestra responsables de los informes, sus periodos, fechas de finalización y observaciones. Permite **Participó**, **No participó** o **Mantener pendiente**, con motivo obligatorio. Se puede revisar una resolución previa: se agrega una versión nueva y se conserva el historial de decisiones, motivos, responsables y fechas.

La resolución se guarda por persona y salida, con la evidencia revisada, sin modificar informes originales. Participó acredita una sola salida; No participó no la acredita; Mantener pendiente la deja fuera del total. Si llega otro informe finalizado concordante, se conserva la resolución. Un informe nuevo contradictorio o una modificación de la evidencia revisada vuelve a exigir revisión. Se comprueba también que los informes no hayan cambiado mientras el modal estaba abierto. La resolución queda auditada en la salida y en sus inscripciones.

Requiere aplicar `schema.sql` antes del despliegue: agrega `attendance_resolutions`, la vista `volunteer_attendance_evidence` y la función de vigencia de resoluciones. Aplicar la migración antes de desplegar. Las pruebas están en `scripts/test-volunteer-participation.mjs`.

## Editor de un bloque de convocatoria

«Editar salida» abre un editor de cinco secciones: Información general, Fechas y cupos, Participación y logística, Fotos y Publicación. En desktop se navega desde la columna lateral; en celular, desde un selector en modal. La barra fija permite guardar o descartar el conjunto de cambios.

Los campos heredados indican su origen y pueden personalizarse por bloque. La solicitud de apoyo y el plan de trabajo son datos comunes; si afectan varios bloques, requieren confirmación y permiso sobre todos ellos. Las fotos nuevas, selección de galería, portada y metadatos permanecen pendientes hasta guardar. Completar, cancelar o eliminar se encuentran en Publicación → Acciones de la convocatoria y requieren guardar o descartar antes los cambios pendientes.

El servidor valida conjuntamente fechas, cierre, cupos, motivos, permisos, herencia y fotos antes de actualizar la base en una transacción. Una versión de la ficha detecta ediciones concurrentes. Los errores conservan el formulario y seleccionan la sección que requiere corrección. No requiere una migración de base de datos. Prueba local: `node --env-file=.env.local scripts/test-outing-editor.mjs`.

El formulario de nueva convocatoria y de nuevo bloque utiliza las mismas cinco secciones, navegación lateral/selector móvil y barra fija para publicar o descartar. Conserva la vinculación a convocatoria de origen, los periodos múltiples, las fotos y el resumen de publicación. Los errores abren su sección y conservan los datos. Guardar como borrador permanece como alternativa opcional dentro de Publicación.

## Navegación por secciones en Coordinación y el informe del 70

El patrón de secciones se replica en la edición de datos comunes de una convocatoria en serie, la creación de series manuales, Administración y la ficha de voluntariado. En desktop se usa navegación lateral (pasos compactos en las importaciones); en celular, un selector en modal. Las secciones permanecen montadas para conservar los datos y las selecciones al navegar.

- **Convocatoria en serie:** información general, solicitud de apoyo, participación/logística, fotos y bloques/revisión. Guardado único con selección explícita de campos y alcance de herencia. Los errores mantienen el formulario.
- **Serie manual nueva:** información de la serie, selección de salidas y revisión. Conserva búsqueda y selección entre secciones.
- **Administración:** accesos, importación de voluntariado y conciliación de pólizas. Cada importación separa cargar, revisar y confirmar; no escribe datos en la previsualización. Tras aplicar, limpia la carga y muestra una franja de confirmación. Los permisos se verifican en servidor.
- **Ficha de voluntariado:** información personal, participaciones, unidades, pólizas e incidentes. Conserva los permisos y acciones existentes; no agrega un guardado global a una ficha de consulta.
- **Informe del 70:** datos de la gira, labores/acciones, asistencia, observaciones y revisión final. La barra fija conserva Guardar borrador y Finalizar informe. Los errores abren su sección. Un borrador sigue pendiente y no acredita asistencia; el informe finalizado conserva el bloqueo de edición.

Estos cambios no requieren migración de base de datos. Se verificaron navegación desktop/celular, conservación de campos tras errores y cambio de sección, un borrador del 70, y previsualización/aplicación de un CSV ficticio en la base demo local.
