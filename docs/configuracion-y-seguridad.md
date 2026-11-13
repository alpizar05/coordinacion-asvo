# Configuración y seguridad después de la reorganización

Revisión local del 13 de noviembre de 2026. No cambia permisos efectivos, proveedores, secretos ni datos de beta. No constituye una auditoría de infraestructura ni una política de conservación aprobada.

## Controles implementados

`lib/runtime-config.mjs` contiene validadores puros por funcionalidad. `lib/server-config.mjs` lee el entorno exclusivamente en servidor. Los diagnósticos indican funcionalidad, nombre de variable y código; nunca su valor, la URL de conexión, respuesta completa del proveedor ni filas de PostgreSQL. La creación de convocatorias usa el diagnóstico saneado en vez de registrar excepciones SQL completas. Auth.js y Graph mantienen sus diagnósticos con listas explícitas de códigos/referencias.

| Funcionalidad | Variables y condiciones |
| --- | --- |
| PostgreSQL | `DATABASE_URL`, protocolo PostgreSQL, nombre de base y opciones permitidas. Para un host remoto, usuario/contraseña y `sslmode=require`, `verify-ca` o `verify-full`. No se permiten parámetros que redirijan el host. |
| URLs generadas | `APP_URL`, origen sin credenciales, ruta, query ni fragmento; HTTPS fuera de loopback. |
| Demo de aplicación | `ASVO_DEMO=1`, `NODE_ENV=development`, base y origen loopback y ausencia de indicadores Vercel. Cualquier demo en Production/Preview se rechaza. |
| Entra | `AUTH_MICROSOFT_ENTRA_ID_ID` UUID, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_SECRET` de al menos 32 caracteres, issuer `https://login.microsoftonline.com/<tenant UUID>/v2.0`. No `common` ni `organizations`. El sujeto requiere `tid` del directorio esperado y `oid` UUID. |
| Correo Graph | `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER` con formato de correo. Los dos IDs son UUID; no hay fallback implícito entre secretos de Auth y Graph. |
| Fotografías Graph | Las tres credenciales anteriores más `SHAREPOINT_PHOTO_DRIVE_ID` y `SHAREPOINT_PHOTO_FOLDER_ID`, identificadores sin rutas ni caracteres de URL. |
| Cron | `CRON_SECRET` de al menos 32 caracteres. Mantiene rechazo de autorización incorrecta y deshabilitación en demo/Preview. |
| Límites de intentos | `RATE_LIMIT_SECRET` opcional, de al menos 32 caracteres; de lo contrario `AUTH_SECRET`. Solo el demo local validado usa una clave fija ficticia. |

La longitud mínima no garantiza entropía: generar secretos aleatorios sigue siendo responsabilidad de despliegue. No se rotó ninguno. Se rechazan variables `NEXT_PUBLIC_` no vacías cuyo nombre identifica credenciales de DB/Graph/SharePoint, contraseñas, secretos o tokens; no es un escáner universal de secretos.

Las comprobaciones se realizan cuando se usa la funcionalidad correspondiente, antes de consultar el proveedor; no se exige correo o Entra para navegar un demo local. El cron comprueba su propia configuración. El worker valida PostgreSQL y Graph valida credenciales cuando necesita autenticar; los destinatarios `.test` siguen descartándose antes de Graph. Los comandos de migración y revisión de correo validan la conexión sin ejecutar migraciones o envíos implícitos.

Comprobación sin red ni base:

```sh
npm run config:check
# Solo una funcionalidad, con el archivo local explícitamente elegido:
node --env-file=.env.local scripts/check-config.mjs --mode=development --feature=database
# Antes de un despliegue futuro; usar un archivo privado revisado por su propietario:
node --env-file=ARCHIVO_PRIVADO scripts/check-config.mjs --mode=production
```

`--mode` solo modifica la copia del entorno utilizada por el diagnóstico; no configura Next ni persiste valores. En demo local, el informe identifica Auth/Graph/cron como deshabilitados, no como credenciales verificadas. Un diagnóstico sintáctico correcto no demuestra conectividad, autorización ni entrega.

## Frontera servidor y demo

DB, sesión, lector de credenciales, adaptadores Graph, límites y revocación usan `import 'server-only'`. Next rechaza su importación desde un Client Component; los módulos puros de reglas y validación siguen compartibles. Las Server Actions conservan su frontera `use server`, autorización y validación de entrada.

`scripts/node-server-context.mjs` habilita explícitamente el marcador vacío de Next para mantenimiento y pruebas Node. No es una dependencia de aplicación ni se utiliza en el bundle del navegador. No elimina la frontera que verifica el compilador de Next.

`npm run dev` escucha en `127.0.0.1`. El acceso a la sesión demo y sus acciones de sesión comprueba también un Host loopback. No son credenciales para una red: no exponer el servidor demo mediante túneles/proxy ni cambiar el bind para hacerlo público; un Host falsificable por acceso de red no sustituye autenticación. Los seeds y pruebas siguen exigiendo destino local autorizado, datos ficticios y destinatarios `.test`; también rechazan indicadores Vercel o `NODE_ENV=production`. La carga demo de CLI no exige `NODE_ENV=development`, porque Node de mantenimiento no es Next.

## Enlaces privados y exposición

Son capacidades aleatorias de 32 bytes (43 caracteres base64url). Las tablas de acceso conservan SHA-256; la lectura y mutación verifican alcance y reloj de PostgreSQL. Los hashes no permiten recuperar el enlace, pero quien tenga la URL puede actuar con su alcance.

| Capacidad | Alcance, vigencia y revocación |
| --- | --- |
| Gestión de inscripción | Una inscripción. Se genera hasta el mayor de `MANAGEMENT_HOURS` (72 por defecto) y siete días después de la última fecha de participación/salida. Lectura admite propósitos históricos conocidos `gestion`, `validar`, `gestionar`; las mutaciones conservan exclusivamente `validar`/`gestionar`, estado editable, póliza y reglas actuales. |
| Recibo de inscripción | Solo confirmación de recepción para la salida vinculada, diez minutos; cookie HttpOnly, SameSite Lax, Secure en producción. No permite gestionar otra inscripción. |
| Invitación | Una salida y una persona concretas, siete días; se consume en la transacción de inscripción y no admite reutilización. |
| Resumen/informe del 70 | Siete días, vinculado a salida e inscripción confirmada que mantiene la asignación 70. Revocación existente y cambios de asignación impiden uso posterior; informe finalizado permanece bloqueado. |

La migración **0004** agrega `revoked_at` a gestión, recibos e invitaciones. Las consultas aplican revocación y vigencia mediante `clock_timestamp()`. Los casos internos `revokeRegistrationLinks` y `revokeOutingInvitations` bloquean el recurso, exigen las políticas existentes por unidad y auditan; no introducen UI ni una acción pública nueva. Un futuro punto de entrada deberá autenticar antes de llamarlos. La revocación del resumen del 70 conserva su acción existente. No se revocan enlaces de personas automáticamente en esta etapa.

Se retiró el borrado implícito de recibos vencidos al recibir otra inscripción. Expiración significa denegar acceso, no borrar evidencia. No se eliminan enlaces, intentos ni auditorías por una política nueva.

**Límite importante:** outbox y bandeja demo contienen cuerpos de correo y URLs privadas en texto, necesarios para el envío/revisión existente. También pueden persistir en el buzón, historial del navegador y logs de acceso del alojamiento. No se afirma que todo token esté guardado únicamente como hash. No se agregaron tokens a localStorage. Se mantiene el almacenamiento autorizado de «Recordar mis datos» y el contexto mínimo de navegación.

`Referrer-Policy: no-referrer`, cache privado/no-store y exclusión de indexación reducen exposición. El log de peticiones de Next omite rutas `/privado`, `/resumen-salida` y queries de invitación; los logs de fetch no muestran URL completa. Esto no controla los logs de Vercel, proxy, monitorización o errores no capturados. Queda pendiente configurar su redacción/retención y comprobarla sin pegar URLs privadas en reportes.

## Límites contra abuso

Ventanas fijas de quince minutos y actualización atómica en PostgreSQL:

- Hasta 8 intentos por identificación válida de nueve dígitos en inscripción pública.
- Hasta 300 por dirección de red conocida, para compartir conexión sin el anterior límite de 30 personas/intentos.
- Hasta 30 mutaciones por enlace de inscripción y 30 envíos por enlace de informe, con presupuestos separados; 300 por red conocida para cada familia.

Las claves almacenadas son HMAC-SHA256 con ámbito; no IP, identificación o token crudos. Las mutaciones privadas consumen el presupuesto en una transacción independiente: fallar por enlace inexistente o validación no permite revertir el contador. La inscripción pública conserva su transacción y los límites existentes por persona. No se añaden límites de sesión al trabajo normal de Coordinación ni se cambia la promoción FIFO, cupos, correos o auditoría.

Solo se acepta `x-vercel-forwarded-for` cuando `VERCEL=1`, con formato IP validado. En local u otro alojamiento sin IP confiable se omite la cuota gruesa de red; nunca se agrupa todo bajo una dirección `local` compartida. Los límites de persona/capacidad siguen activos. Hay que comprobar posteriormente que el proxy sobrescriba ese header y no admita suplantación. Una ventana fija permite ráfagas cerca del límite entre ventanas. Los límites en DB no sustituyen protección de borde contra ataques distribuidos, lectura repetitiva de imágenes ni creación de muchos tokens aleatorios; esos controles quedan para infraestructura. No se implementó limpieza de intentos sin política aprobada.

Se mantienen el límite Server Actions de 4 MB, CSV de 150 KB, imagen individual de 3 MB, máximo de seis fotos y límite de decodificación de 24 millones de píxeles. No se incrementaron tamaños ni se abrió CORS/allowedOrigins.

## Cabeceras y compatibilidad

Globales: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, Permissions-Policy sin cámara/micrófono/geolocalización/pagos/USB y CSP parcial exigible:

```text
object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://login.microsoftonline.com
```

No bloquea scripts/estilos inline que Next necesita ni conexiones de Auth.js; por eso no equivale a una CSP completa contra XSS. No se añade `unsafe-eval` en producción. No se incorporó COOP/COEP para evitar interferencias con autenticación. HSTS por un año solo en build producción con APP_URL HTTPS; sin `includeSubDomains` ni `preload`. Las rutas de Coordinación, auth, enlaces privados e invitaciones tienen cache privado/no-store y noindex/nofollow; Next conserva su manejo dinámico.

La prueba HTTP local usa rutas reales de Next/Auth.js y ninguna petición a Microsoft. El login real/redirect/logout, el dominio final y los headers efectivos de CDN deben verificarse en una etapa posterior autorizada. Una CSP estricta con nonces exige diseñar render dinámico, medir impacto y probar scripts/estilos; queda pendiente. Referencia: [CSP en Next.js](https://nextjs.org/docs/app/guides/content-security-policy).

## Verificación reproducible y límites

```sh
npm run config:check
npm run test:unit:coverage
npm run test:contracts
npm run test:integration
npm run test:security:build
npm run check
```

Unitarias sin red/base/credenciales; integración crea y elimina bases `asvo_integration_test_*`, con destinatarios ficticios y Graph simulado. Incluye alcance/expiración/revocación/replay, autorización de revocación, conservación de recibos vencidos, HMAC, presupuestos concurrentes/red compartida, host demo y configuración inválida antes de red. Las regresiones verifican formularios, cupos, FIFO, notificaciones, rollback y concurrencia. Resultado: 92 pruebas unitarias, cinco contratos/inventarios y 18 grupos de integración. Cobertura del subconjunto declarado de 35 módulos puros: 100 % líneas, 96,53 % ramas y 99,53 % funciones; no es cobertura global. TypeScript y compilación también verificados.

La prueba de build copia código a un directorio temporal **sin archivos .env**, usa configuración ficticia y una conexión deliberadamente imposible; bloquea fetch externo. Compila, comprueba cabeceras HTTP, `/api/auth/providers`, cron no autorizado y que Next rechace un Client Component que importe DB. Retira servidor/copia; no usa credenciales reales ni la base de aplicación. Evidencia resumida en `tests/security/build-results.json`. No es una nueva evaluación visual/accesibilidad de toda la plataforma ni una autenticación real de Entra.

La migración 0004 solo se ejecutó en bases desechables. **Antes de publicar en el futuro, aplicar esa migración al destino revisado y coordinar el despliegue del código que consulta las nuevas columnas.** No ejecutar los comandos de prueba contra beta. No hubo publicación en esta etapa.

Decisiones de conservación y comprobaciones de permisos reales: [documento separado](seguridad-infraestructura-y-retencion.md).

## Publicación autorizada — 13 de noviembre de 2026

Después de terminar la revisión aislada, se comprobó el plan de Neon: 0001–0003 aplicadas y solo 0004 pendiente. Se aplicó 0004 mediante el ejecutor numerado, con resultado sin pendientes. Es una ampliación de columnas de revocación; no genera enlaces, notificaciones ni envíos y no borra datos. No se cambiaron grants ni secretos. La comprobación offline del archivo local de producción indicó que no contiene AUTH_SECRET, GRAPH_SENDER ni CRON_SECRET; no se reemplazaron variables remotas basándose en esa copia incompleta. El estado final del despliegue se verifica por separado. Las afirmaciones de aislamiento anteriores describen las pruebas de desarrollo, previas a esta autorización.
