# How to: desplegar y configurar la plataforma de voluntariado ASVO

Guía operativa actualizada el 9 de noviembre de 2026. Describe la beta desplegada y cómo reproducir su configuración. No contiene contraseñas, secretos, conexiones de base de datos ni datos personales de participantes. Los identificadores de recursos que aparecen aquí no son credenciales.

## 1. Herramientas y responsabilidades

| Herramienta | Uso |
| --- | --- |
| React, Next.js App Router y TypeScript | Portal público, Coordinación, acciones de servidor y API |
| Node.js y npm | Dependencias, compilación y scripts de administración |
| Git y GitHub | Código y versiones: [alpizar05/coordinacion-asvo](https://github.com/alpizar05/coordinacion-asvo) |
| Vercel | Alojamiento y despliegue desde GitHub; variables y logs |
| Neon PostgreSQL | Registro, permisos, convocatorias, inscripciones, informes y cola de correo |
| Microsoft Entra ID y Auth.js | Inicio de sesión del personal del directorio ASVO |
| Microsoft Graph | Acceso de servidor a SharePoint y envío mediante Exchange |
| SharePoint Online | Biblioteca privada para originales de fotos |
| Exchange Online | Envío de confirmaciones y cambios de estado |
| PowerShell y ExchangeOnlineManagement | Configuración administrativa del permiso de correo; no son dependencias del servidor |
| Graph Explorer | Consultas y concesión inicial de acceso al sitio por una persona administradora |
| GoDaddy | DNS del futuro subdominio; todavía no se usa para acceder a la beta |
| Homebrew | Instalación de herramientas en Mac |

Render queda como alternativa de alojamiento, no como servicio activo de esta beta. Docker es opcional para PostgreSQL local; Neon no requiere Docker.

Estado actual: beta en **https://coordinacion-asvo.vercel.app**. El entorno de Vercel se llama **Production**, aunque funcionalmente es una beta. El dominio previsto **voluntariado.asvocr.org** se reserva para el lanzamiento.

## 2. Requisitos y orden de configuración

Necesitás acceso al repositorio y proyecto Vercel, a Neon y a la administración Microsoft 365 de ASVO. El registro de la aplicación y la concesión de permisos requieren una cuenta autorizada. Para Application RBAC de correo se verificaron el rol Administrador de Exchange en Entra y la membresía en Organization Management de Exchange.

Orden recomendado:

1. Preparar código y GitHub.
2. Crear proyecto Vercel y conectar Neon.
3. Configurar Entra y variables de autenticación.
4. Aplicar esquema y asignar permisos de la aplicación.
5. Desplegar y probar inicio de sesión.
6. Configurar SharePoint y probar fotos.
7. Configurar Exchange y probar correos.
8. Completar pruebas de beta y pendientes de operación.

## 3. Código y proyecto Vercel

Desde Terminal:

```sh
git clone https://github.com/alpizar05/coordinacion-asvo.git
cd coordinacion-asvo
npm ci
npm run check
npm run build -- --webpack
```

Usá la versión de Node admitida por las dependencias; esta beta se desplegó con **Node.js 24.x** en Vercel. Los scripts de prueba que ejecutan TypeScript directamente requieren Node 22.18 o posterior.

En Vercel, importá el repositorio y configurá:

| Ajuste | Valor de esta beta |
| --- | --- |
| Project | `coordinacion-asvo` |
| Framework | Next.js |
| Production Branch | `main` |
| Root Directory | Carpeta que contiene `package.json`; raíz si clonaste este repositorio |
| Install Command | `npm ci` o detección automática con lockfile |
| Build Command | `npm run build -- --webpack` |
| Node.js | 24.x |

Se utilizó Webpack porque Turbopack presentó un fallo interno durante la preparación. No cambies esta opción sin verificar una compilación completa.

En **Deployments → Create Deployment**, usá una rama o referencia de commit válida, por ejemplo `main`; la URL raíz del repositorio no identifica un commit. Verificá que el despliegue sea de Production. Un push a la rama de producción conectada normalmente dispara el despliegue.

## 4. Crear PostgreSQL administrado en Neon

1. En Vercel abrí la integración de Neon desde Storage/Marketplace y creá la base.
2. Elegí una región cercana a las funciones; esta beta opera en Washington, D. C. (`iad1`).
3. Elegí el plan según el uso. Neon Auth y Realtime no son necesarios para esta aplicación: la autenticación usa Entra.
4. Conectá la base al proyecto `coordinacion-asvo` y elegí los entornos que correspondan.
5. Confirmá la creación de **`DATABASE_URL`**. La aplicación y los scripts usan ese nombre exacto.

La integración también puede generar `DATABASE_URL_UNPOOLED`, `DATABASE_PGHOST` y otras variables. No hace falta copiarlas todas manualmente ni renombrarlas. La conexión pooled se usa para la aplicación; la unpooled identifica la conexión directa. La integración está documentada por [Neon](https://github.com/neondatabase/website/blob/main/content/faqs/find-database-url-neon.md).

**Pendiente de la beta:** Production y Preview se conectaron inicialmente a la misma base. Separalos antes de trabajar con datos reales; las pruebas de una rama no deben alterar los registros del entorno público.

### Aplicar el esquema

Creá localmente `.env.production.local` con las variables del entorno remoto. Podés obtenerlas desde Vercel con su CLI, si está instalada y vinculada al proyecto:

```sh
vercel link
vercel env pull .env.production.local --environment=production
```

Revisá el archivo de forma privada. Debe apuntar a Neon, tener `APP_URL=https://coordinacion-asvo.vercel.app` y `ASVO_DEMO=0`. No compartas ni subas este archivo. `.gitignore` excluye `.env*`, salvo `.env.example`.

Desde la raíz del proyecto:

```sh
node --env-file=.env.production.local scripts/db.mjs --plan
```

El plan no escribe. Si la base existente es compatible y aún no tiene registro numerado, la adopción es un paso explícito (`scripts/db.mjs --adopt --apply`, cargando el archivo de entorno correspondiente). Después se ejecuta `scripts/db.mjs` para aplicar pendientes. Si es incompatible, detenete y revisá las diferencias; no marques la baseline ni ejecutes SQL a ciegas. Ver [adopción y recuperación](migraciones-numeradas.md). Estos ejemplos son para una intervención futura autorizada; no se accedió a beta durante la refactorización.

El comando devuelve un plan JSON con migraciones aplicadas, pendientes y compatibilidad de adopción. Verificá en Neon SQL Editor:

```sql
select to_regclass('public.volunteers') as voluntariado,
       to_regclass('public.outings') as salidas,
       to_regclass('public.registrations') as inscripciones,
       to_regclass('public.outing_reports') as informes;
```

Los resultados deben ser nombres de tablas, no `null`. Esta consulta básica no sustituye la verificación estructural completa de adopción. Al ejecutarse sin flags, el script aplica únicamente migraciones numeradas de estructura y catálogo operativo. No ejecuta transformaciones históricas, genera enlaces o avisos ni despacha correo pendiente. Las transformaciones de unidades, herencia y flujo de inscripción requieren el comando histórico explícito; consultá la [guía de operaciones de base](operaciones-base-datos.md) antes de usarlo en una base existente. No se ejecutaron estos cambios sobre beta durante la refactorización. No lo agregues indiscriminadamente al build de cada Preview.

## 5. Microsoft Entra ID: inicio de sesión

En [Entra](https://entra.microsoft.com), abrí **Registros de aplicaciones** y creá o seleccioná una aplicación de un solo directorio de ASVO.

### Identificadores de la instalación actual

| Recurso | Identificador |
| --- | --- |
| Nombre | ASVO Coordinación de Voluntariado |
| Directorio / tenant | `d5253b02-f376-4ea5-8b70-9dcc230279ba` |
| Aplicación / Client ID | `f7b53958-aa46-4369-bd2d-80ee370835a0` |
| Objeto de aplicación empresarial / service principal | `bca36a77-45de-46e9-81d4-5c1b19522bd5` |

El **Id. de objeto de Registros de aplicaciones**, el **Id. de objeto de Aplicaciones empresariales** y el **Id. de objeto de cada usuario** son distintos. Para Exchange se usa el de la aplicación empresarial; para los roles de la plataforma, el del usuario.

En **Autenticación**, agregá plataforma **Web** con URI de retorno:

```text
https://coordinacion-asvo.vercel.app/api/auth/callback/microsoft-entra-id
```

En **Certificados y secretos**, creá un secreto y copiá su **Valor**, visible al crearlo. No uses el Id. del secreto. Conservá el valor en un gestor de secretos y registrá su vencimiento.

El emisor de ASVO es:

```text
https://login.microsoftonline.com/d5253b02-f376-4ea5-8b70-9dcc230279ba/v2.0
```

La implementación verifica el tenant y usa `client_secret_post`. Para comprobar credenciales sin imprimir ni guardar tokens:

```sh
node --env-file=.env.production.local scripts/check-entra.mjs
```

Esta prueba verifica Client ID, tenant y secreto; no sustituye probar el inicio de sesión de una persona en el navegador.

## 6. Variables de entorno de Vercel

En **Settings → Environment Variables**, guardá cada valor sin comillas envolventes ni saltos de línea accidentales. Los secretos quedan solo en servidor; no uses prefijo `NEXT_PUBLIC_`.

| Variable | Configuración |
| --- | --- |
| `DATABASE_URL` | Conexión Neon creada por la integración |
| `APP_URL` | `https://coordinacion-asvo.vercel.app`, sin barra final |
| `ASVO_DEMO` | `0` para beta desplegada; `1` solo para desarrollo local demo |
| `AUTH_SECRET` | Secreto aleatorio exclusivo para Auth.js; se puede generar con `openssl rand -base64 32` |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Client ID de Entra |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Valor del secreto de Entra |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Emisor completo indicado arriba |
| `GRAPH_TENANT_ID` | Solo UUID del directorio, sin URL ni `/v2.0` |
| `GRAPH_CLIENT_ID` | Client ID de la aplicación autorizada |
| `GRAPH_CLIENT_SECRET` | Valor del secreto usado por Graph |
| `GRAPH_SENDER` | Beta: `alvaro.alpizar@asvocr.org` |
| `CRON_SECRET` | Secreto aleatorio para autorizar el cron; generar con `openssl rand -hex 32` y guardar en Production |
| `SHAREPOINT_PHOTO_DRIVE_ID` | Id. de la biblioteca, no su nombre ni URL |
| `SHAREPOINT_PHOTO_FOLDER_ID` | Id. de la carpeta dentro de la biblioteca |
| `MANAGEMENT_HOURS` | `72`, duración mínima de enlaces de gestión; se extiende según fechas de salida |
| `CANCELLATION_HOURS` | `48`, parámetro de cancelación de la aplicación |

`.env.example` conserva `VALIDATION_HOURS` como configuración histórica; el flujo actual no requiere una validación inicial por correo de la persona voluntaria.

Esta instalación reutiliza la aplicación de Entra para login y Graph. **Actualizar `AUTH_MICROSOFT_ENTRA_ID_SECRET` no actualiza `GRAPH_CLIENT_SECRET`**: al rotarlo hay que reemplazar ambos si comparten credencial.

Después de cambiar variables, hacé **Deployments → último despliegue Production → ⋯ → Redeploy**. Los valores nuevos no se aplican retroactivamente al despliegue anterior. [Documentación de Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).

## 7. Permisos de personal en PostgreSQL

Entra permite autenticar; la tabla `grants` determina qué puede hacer cada persona. Obtené el Id. de objeto en **Entra → Usuarios → persona → Información general**.

Ejemplo en Neon SQL Editor, reemplazando el identificador:

```sql
begin;
insert into grants(subject,role,unit)
values ('ID-OBJETO-USUARIO','general','') on conflict do nothing;
insert into grants(subject,role,unit)
values ('ID-OBJETO-USUARIO','admin','') on conflict do nothing;
commit;
```

| Rol | Alcance |
| --- | --- |
| `general` | Coordinación general |
| `unidad` | Coordinación de la unidad exacta guardada en `unit` |
| `admin` | Administración del registro y otras funciones administrativas |

`admin` no implica automáticamente `general`; asigná ambos cuando la persona deba administrar y coordinar. Estos roles de la aplicación no conceden administración del tenant Microsoft.

El registro de voluntario y la póliza son independientes del acceso institucional. Para inscribirse se necesita identificación registrada, correo, pertenencia a la unidad que corresponda y póliza verificada que cubra las fechas. Todas las personas pertenecen a Voluntariado General. No ejecutes los scripts de ejemplos locales sobre Neon; prepará cargas privadas específicas para beta. Las pólizas ficticias deben identificarse como prueba y sustituirse antes del uso real.

## 8. SharePoint: biblioteca y fotos

Sitio correcto de esta instalación:

```text
https://asvocr.sharepoint.com/sites/CoordinacindeVoluntariadoASVO
```

Se creó una biblioteca privada **Archivos de voluntariado** y una carpeta **Fotos de convocatorias**. No uses el sitio anterior denominado Coordinación de Unidades.

### Conceder acceso al sitio

1. En el registro de aplicación: **Permisos de API → Microsoft Graph → Permisos de aplicación → Sites.Selected**.
2. Concedé consentimiento de administrador para ASVO.
3. Con una sesión administrativa de Graph Explorer, obtené el sitio:

```http
GET https://graph.microsoft.com/v1.0/sites/asvocr.sharepoint.com:/sites/CoordinacindeVoluntariadoASVO
```

4. Usá el `id` devuelto para conceder `write` a la aplicación:

```http
POST https://graph.microsoft.com/v1.0/sites/SITE_ID/permissions
Content-Type: application/json
```

```json
{
  "roles": ["write"],
  "grantedToIdentities": [{
    "application": {
      "id": "f7b53958-aa46-4369-bd2d-80ee370835a0",
      "displayName": "ASVO Coordinación de Voluntariado"
    }
  }]
}
```

El consentimiento de `Sites.Selected` por sí solo no concede acceso al sitio: hace falta esta asignación. Graph Explorer requiere sus propios permisos delegados y una cuenta administrativa autorizada para crearla; se utilizó `Sites.FullControl.All` delegado para esa operación. No concedas ese permiso amplio a la aplicación de ejecución. [Modelo de permisos seleccionados de Microsoft](https://learn.microsoft.com/en-us/graph/permissions-selected-overview).

### Obtener biblioteca y carpeta

```http
GET https://graph.microsoft.com/v1.0/sites/SITE_ID/drives?$select=id,name,webUrl
GET https://graph.microsoft.com/v1.0/drives/DRIVE_ID/root/children?$select=id,name,folder
```

Elegí **Archivos de voluntariado**, no la biblioteca Documentos. Conservá los identificadores exactos:

| Recurso | Valor actual |
| --- | --- |
| Site ID | `asvocr.sharepoint.com,2e630f7d-ff65-4003-94c5-b70c0b8cb7e8,f873be16-0c59-430d-830b-236b36dfd038` |
| `SHAREPOINT_PHOTO_DRIVE_ID` | `b!fQ9jLmX_A0CUxbcMC4y36Ba-c_hZDA1Dgwsjazbf0DiH8kpAicJ7T6PXmlrZbQ7Q` |
| `SHAREPOINT_PHOTO_FOLDER_ID` | `01BRNHCNJGSDDN767BPZFJNDNQ7LAJO4Y3` |

Si recreás la biblioteca o carpeta, obtené los nuevos IDs. Guardalos en Vercel junto con las credenciales Graph y redesplegá. Probá publicar una convocatoria con foto y verificá el original en SharePoint.

La plataforma admite hasta seis fotos, JPG/PNG/WebP de hasta 3 MB por archivo. Los originales van a SharePoint; las versiones optimizadas WebP se conservan actualmente en PostgreSQL y se entregan por la aplicación. Retirar una foto del portal no elimina el original de SharePoint.

## 9. Exchange Online: correo restringido a un buzón

Remitente de beta: **alvaro.alpizar@asvocr.org**. Remitente previsto para lanzamiento: **nacional@asvocr.org**, todavía fuera del alcance autorizado. El destinatario es el correo del registro de cada voluntario; cambiar el remitente no cambia los destinatarios.

Se utiliza **Application RBAC de Exchange** con `Application Mail.Send` limitado por un Management Scope. No se agrega `Mail.Send` de aplicación sin alcance en Entra: los permisos de ambas vías son independientes y un permiso amplio adicional evitaría la restricción pretendida. [Guía de Microsoft](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

### Instalar herramientas en Mac

En Terminal (`zsh`), preferí PowerShell estable cuando esté disponible:

```sh
brew install --cask powershell
pwsh -NoProfile
```

En la máquina de esta beta se instaló Preview con `brew install --cask powershell@preview`; se inicia con:

```sh
/usr/local/bin/pwsh-preview -NoProfile
```

No confundas los comandos `pwsh` y `pwsh-preview`. A continuación ejecutá dentro de PowerShell:

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName alvaro.alpizar@asvocr.org
```

Si solicita confiar en PSGallery, confirmá la instalación. PowerShell solo administra Microsoft 365: no tiene que permanecer abierto para que la aplicación envíe correo.

### Verificar permisos del administrador

La cuenta debe tener el rol Administrador de Exchange activo en Entra y la delegación necesaria en Exchange. Se verificó membresía en **Exchange Admin Center → Roles → Roles de administrador → Organization Management → Asignada**. La persona usuaria, no la aplicación, se agrega al grupo.

```powershell
Get-Command New-ServicePrincipal,New-ManagementScope,New-ManagementRoleAssignment
Get-RoleGroupMember -Identity "Organization Management"
Get-ManagementRoleAssignment -Role "Application Mail.Send" -Delegating $true -GetEffectiveUsers |
    Format-Table RoleAssigneeName,EffectiveUserName,AssignmentMethod
```

Si la organización exige habilitar personalización, una persona administradora ejecuta una sola vez:

```powershell
Enable-OrganizationCustomization
```

### Crear la configuración (solo si todavía no existe)

No recrees estos objetos al retomar la instalación actual: ya se crearon y probaron.

```powershell
New-ServicePrincipal -AppId "f7b53958-aa46-4369-bd2d-80ee370835a0" -ObjectId "bca36a77-45de-46e9-81d4-5c1b19522bd5" -DisplayName "ASVO Coordinación de Voluntariado"

New-ManagementScope -Name "ASVO-Correo-Pruebas" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'alvaro.alpizar@asvocr.org'"

New-ManagementRoleAssignment -Name "ASVO-Enviar-Pruebas" -Role "Application Mail.Send" -App "bca36a77-45de-46e9-81d4-5c1b19522bd5" -CustomResourceScope "ASVO-Correo-Pruebas"
```

### Comprobar alcance

```powershell
Test-ServicePrincipalAuthorization -Identity "bca36a77-45de-46e9-81d4-5c1b19522bd5" -Resource "alvaro.alpizar@asvocr.org"
Test-ServicePrincipalAuthorization -Identity "bca36a77-45de-46e9-81d4-5c1b19522bd5" -Resource "nacional@asvocr.org"
```

Esperado: `InScope=True` para Álvaro y `False` para nacional, en `Application Mail.Send`. El test no envía correo y no incluye permisos independientes concedidos en Entra. Los cambios de autorización de aplicación pueden tardar en reflejarse en el envío real; Microsoft documenta caché de 30 minutos a 2 horas, mientras el comando de prueba evita esa caché.

En esta instalación la creación de la asignación falló temporalmente con error de delegación incluso después de verificar membresía, roles y alcance. Tras dejar pasar tiempo y reconectar, funcionó. La propagación es una explicación posible, no una causa demostrada; no se solucionó agregando permisos ilimitados.

Finalizá la sesión administrativa cuando termines:

```powershell
Disconnect-ExchangeOnline -Confirm:$false
exit
```

### Probar desde la plataforma

Confirmá `GRAPH_SENDER` y las tres credenciales Graph en el despliegue vigente. Inscribí una persona de prueba en una salida vigente; verificá modal de recepción, estado y correo con enlace privado. Confirmá luego desde Coordinación y verificá el segundo mensaje. **Ambos envíos se comprobaron en la beta.**

## 10. Cola y reintentos de correo

Los nuevos mensajes guardan `html_body` además del texto. La plantilla incorpora el logo público `/logo-asvo.png`, paleta ASVO, nombre, estado, lugar, unidad, fechas y enlace privado. La columna se agrega de forma compatible mediante la baseline numerada y las migraciones explícitas; debe existir antes de desplegar el nuevo código. Los mensajes ya pendientes sin HTML conservan su formato de texto. La bandeja demo muestra el texto. No se adjunta el PDF del formulario anterior ni se promete crear automáticamente un grupo de WhatsApp.

Los mensajes se guardan en `registration_mail_outbox` dentro de la transacción de la inscripción. La aplicación intenta enviarlos después de cada operación. Los fallos confirmados anteriores al envío y rechazos explícitos quedan pendientes; los resultados ambiguos se detienen para revisión. Una reserva dura cinco minutos y cada ejecución procesa hasta 30 mensajes respetando el orden por inscripción. `sent_at` representa aceptación, no entrega. Consultá [recuperación, revisión y migración 0003](resultados-de-correo.md) antes de actualizar el worker.

Consultar conteos en Neon sin exponer contenidos ni enlaces privados:

```sql
select count(*) filter (where delivery_state='pending' and cancelled_at is null) as pendientes,
       count(*) filter (where delivery_state='uncertain') as requieren_revision,
       count(*) filter (where sent_at is not null) as aceptados
from registration_mail_outbox;
```

Reintento puntual desde una máquina autorizada:

```sh
node --env-file=.env.production.local scripts/mail-outbox.mjs
```

Este comando **envía mensajes reales pendientes** a sus destinatarios. Si todavía no son elegibles para reintento, respetará `retry_at`. Puede requerir varias ejecuciones si hay más de 30 mensajes.

Para un proceso persistente administrado, con variables remotas correctas:

```sh
node --env-file=.env.production.local scripts/mail-outbox.mjs --watch
```

`--watch` revisa cada minuto mientras el proceso está activo. No equivale a un servicio instalado ni continúa si cerrás la terminal. El proyecto incluye ahora `GET /api/cron/correos` y su programación en `vercel.json`: `0 12 * * *` (12:00 UTC, 6:00 a. m. de Costa Rica). Es una frecuencia compatible con Vercel Hobby; puede ejecutarse dentro de esa hora, y un fallo puede esperar hasta el próximo día. El envío inmediato después de cada operación sigue activo. Para reintentos cada pocos minutos se necesita otra frecuencia admitida por el plan o un programador externo; no está configurado en esta beta.

Para activarlo:

1. Generá un secreto con `openssl rand -hex 32`.
2. Guardalo como `CRON_SECRET` en Vercel, entorno Production. No lo pegues en el chat ni en Git.
3. Desplegá el código que incluye `vercel.json` y el endpoint.
4. Revisá el cron en Settings → Cron Jobs y ejecutá Run para probarlo. Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente.
5. Comprobá los logs `[mail-cron]` y los conteos de pendientes. La ejecución puede enviar correos reales pendientes.

La ruta responde 401 sin autorización, 503 si falta configuración, falla el procesamiento o está en demo/Preview, y 200 si completa el lote. Devuelve solo los conteos `sent` y `failed`, nunca destinatarios ni enlaces. No almacena respuestas en caché. En local requiere `ASVO_DEMO=0` y el secreto; una llamada en modo demo no envía correo.

El procesamiento tiene presupuesto de tiempo para terminar antes del límite de 60 segundos de la función y deja el resto para futuras ejecuciones. La reserva atómica de cada mensaje evita que dos ejecuciones concurrentes lo reclamen a la vez durante sus cinco minutos de reserva. Los mensajes de la misma inscripción siguen en orden. Vercel no garantiza reintento inmediato de una invocación fallida: la próxima ejecución vuelve a consultar la cola. [Seguridad y ejecución de cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [límites por plan](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Prueba del endpoint sin base ni correo real: `node scripts/test-mail-cron.mjs`. La prueba local `npm run test:registration` verifica un fallo de Graph simulado y recuperación desde la cola.

Los scripts npm `mail:retry` y `mail:worker` leen `.env.local`; usá los comandos explícitos anteriores para operar sobre la beta remota. Una interrupción entre aceptación de Graph y confirmación de base puede producir duplicados.

## 11. Actualizaciones, respaldo y diagnóstico

Para actualizar código: verificá TypeScript y compilación, revisá el diff, subí los cambios aprobados a GitHub y comprobá el despliegue de Production. Si hay cambios de esquema, aplicalos contra la base correcta antes de validar las funciones que dependen de ellos. Un rollback de Vercel revierte código, no datos ni migraciones.

Definí respaldo y retención según el plan Neon y realizá una prueba de restauración en una base separada. Un backup lógico puede generarse con herramientas PostgreSQL compatibles, usando una conexión directa guardada de forma privada; el archivo resultante contiene datos personales y debe almacenarse fuera del repositorio. Respaldar PostgreSQL no respalda los originales de SharePoint.

| Síntoma | Comprobación / solución |
| --- | --- |
| `ECONNREFUSED` a localhost | Base local apagada o URL local usada por error; iniciá PostgreSQL local o elegí la conexión Neon correcta |
| `command not found: docker` | Docker no instalado; es opcional, ver alternativa local en README |
| `command not found: pwsh` tras instalar Preview | Usá `/usr/local/bin/pwsh-preview` |
| OAuthCallbackError / `AADSTS7000215` | Client ID, tenant y **Valor** del secreto; el Id. del secreto no sirve. Probá `check-entra.mjs` y redesplegá |
| Login funciona pero sin permisos | Revisá `grants.subject` con el Id. de objeto del usuario y ambos roles si debe administrar y coordinar |
| SharePoint 401 / `sharepoint-auth` | Revisá `GRAPH_CLIENT_SECRET`, separado del secreto AUTH |
| SharePoint 403 | Consentimiento de Sites.Selected y asignación write sobre el sitio correcto |
| SharePoint 400 / `sharepoint-upload` | IDs exactos de biblioteca y carpeta, sin URL, comillas ni espacios; verificá carpeta con Graph |
| `Authorization_RequestDenied` en Graph Explorer | Permisos de la sesión Explorer y cuenta administradora; son distintos de los permisos de ejecución |
| `New-ServicePrincipal` no reconocido | Sesión Exchange conectada y comandos habilitados por los roles de la cuenta |
| Se exige `Enable-OrganizationCustomization` | Habilitación administrativa de personalización antes de crear el alcance |
| Error de delegación al asignar Mail.Send | Verificá roles Entra, membresía efectiva y delegación sin restricciones; reconectá tras propagación. Si persiste, conservá error completo para soporte |
| Correo no llega | Cola pendiente, `retry_at`, remitente, autorización del buzón, credenciales y spam |
| No production deployments found | Creá despliegue de la rama configurada como producción |
| Cambios de variables no aparecen | Redeploy y comprobación de que estás abriendo el despliegue nuevo |

En Vercel abrí logs de la solicitud y buscá `[auth][diagnostic]`, `[auth][entra-token]`, `[sharepoint][diagnostic]` o `[mail-outcome]` y `[mail-review]`. El inventario `mail:review` permite revisar metadatos de los intentos sin imprimir el mensaje. No habilites impresión de secretos, tokens ni enlaces privados para depurar.

## 12. Checklist de beta y lanzamiento

### Comprobado en esta beta

- [x] Despliegue Vercel y esquema Neon.
- [x] Inicio de sesión institucional.
- [x] Publicación de convocatoria con foto original en SharePoint.
- [x] Tres participantes de prueba y sus permisos cargados.
- [x] Alcance de correo: buzón de prueba permitido y nacional excluido.
- [x] Correo de recepción y correo de confirmación recibidos.

### Pendiente

- [ ] Activar en Vercel el cron diario implementado: configurar `CRON_SECRET`, desplegar y comprobar una ejecución. El fallo y recuperación de correo se verificaron localmente con Graph simulado.
- [ ] Probar acceso y permisos con las otras dos cuentas.
- [ ] Probar cupos, espera, cancelación y promoción automática.
- [ ] Probar enlace privado, edición y cancelación de inscripción.
- [ ] Probar asignación del 70, resumen e informe.
- [ ] Separar base de Preview y Production antes de usar datos reales.
- [ ] Definir respaldos, retención y verificar restauración.
- [ ] Registrar vencimiento y responsable de rotación de secretos.
- [ ] Sustituir pólizas ficticias por cobertura real verificada antes del uso real.
- [ ] Preparar remitente nacional y dominio al lanzar.

Para retomar en el chat: «Retomemos los pendientes de la beta de ASVO, según docs/despliegue-y-configuracion.md».

## 13. Cambio futuro a dominio y remitente institucional definitivo

### Dominio: voluntariado.asvocr.org

1. Agregalo a Production en **Vercel → Settings → Domains**.
2. Copiá el CNAME exacto que muestre Vercel.
3. En GoDaddy, DNS de `asvocr.org`, agregá el host `voluntariado` apuntando a ese destino. No hace falta cambiar los nameservers ni los registros MX del correo.
4. Esperá validación DNS y certificado HTTPS de Vercel.
5. Agregá en Entra el nuevo callback Web `https://voluntariado.asvocr.org/api/auth/callback/microsoft-entra-id`.
6. Actualizá `APP_URL`, revisá cualquier URL de autenticación configurada explícitamente y redesplegá.
7. Probá login, correo y enlaces generados. Conservá inicialmente el dominio anterior y su callback para enlaces ya enviados; no fuerces una redirección durante una sesión de login sin probarla.

Usá siempre el destino DNS indicado para el proyecto, no un CNAME fijo copiado de otra guía. [Dominios en Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

### Remitente: nacional@asvocr.org

Con autorización administrativa, cambiá el alcance existente para permitir únicamente nacional:

```powershell
Set-ManagementScope -Identity "ASVO-Correo-Pruebas" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'nacional@asvocr.org'"
```

La asignación existente seguirá vinculada al alcance, aunque su nombre conserve «Pruebas». Comprobá nacional `True` y Álvaro `False` con `Test-ServicePrincipalAuthorization`, actualizá `GRAPH_SENDER` a `nacional@asvocr.org` y redesplegá. Considerá la propagación antes de la prueba de envío. Elegí una ventana de cambio y supervisá la cola para que los mensajes pendientes se envíen al recuperar autorización. Este cambio **todavía no se ha aplicado**.

## Controles locales incorporados después de la beta

Antes de un futuro despliegue, consultar [configuración y seguridad](configuracion-y-seguridad.md). El diagnóstico `scripts/check-config.mjs --mode=production` no conecta proveedores; valida sintaxis y claves por función. ASVO_DEMO=1 se rechaza fuera de desarrollo local. La migración 0004 agrega revocación de enlaces/recibos/invitaciones y debe coordinarse con el código nuevo. No se ha aplicado a beta en esta revisión. [Retención y comprobaciones efectivas de infraestructura](seguridad-infraestructura-y-retencion.md) siguen pendientes de aprobación/verificación y no deben confundirse con controles ya desplegados.
