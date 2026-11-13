# Preparación de base, datos históricos, ejemplos y correo

Primera etapa de refactorización: separar operaciones, conservando el flujo normal de la aplicación. Los cambios se verifican en una base local desechable; no se aplicaron a beta ni a proveedores. La segunda etapa incorpora migraciones numeradas, checksums y adopción verificada; ver [guía](migraciones-numeradas.md).

## Comandos independientes

Los comandos npm cargan `.env.local`. Revisá el destino antes de cualquier escritura. Los programas Node no cargan otros archivos de entorno por su cuenta.

| Operación | Comando local | Efectos |
| --- | --- | --- |
| Consultar estado/plan | `npm run db:status` / `npm run db:plan` | Solo lectura; no crea tablas ni marcas |
| Adoptar una base existente | `npm run db:adopt -- --apply` | Registra solo la baseline tras verificarla, sin volver a ejecutar su SQL |
| Preparar estructura | `npm run db:setup` o `npm run db:migrate` | Tablas, columnas, índices, vistas, función de asistencia y catálogo de unidades operativas |
| Adaptar datos anteriores | `npm run db:migrate:history -- --apply` | Transformaciones históricas explícitas, con marcas en `app_migrations` |
| Registro ficticio y acceso demo | `npm run db:seed:demo` | Personas/pólizas ficticias y permisos de identidades locales |
| Calendario ficticio | `npm run db:seed:calendar` | Convocatorias de noviembre de 2026 y fotos locales, sin subir a SharePoint |
| Agrupaciones ficticias | `npm run db:seed:groups` | Ejemplo flexible de agrupación |
| Asistencia ficticia | `npm run db:seed:attendance` | Ejemplo de dos informes para conciliar |
| Reintentar correo | `npm run mail:retry` | Procesa explícitamente mensajes pendientes fuera de demo |
| Worker de correo | `npm run mail:worker` | Misma cola, con revisión periódica mientras siga activo |
| Verificación aislada | `npm run test:db:commands` | Crea y elimina una base local temporal; bloquea solicitudes externas |

`db:setup` sigue siendo una entrada para preparar una base vacía o aplicar pendientes de una base registrada. Una base existente sin registro exige primero el plan y una adopción compatible explícita. **`db:setup -- --demo` ahora falla antes de conectar**, con instrucciones para usar `db:seed:demo`. Tampoco se aceptan flags desconocidos. El comando histórico exige exactamente `--apply`; no inicia escrituras cuando falta esa selección explícita.

El catálogo de unidades es información operativa, no datos demo. Preparar estructura no crea permisos, personas, salidas, comunicaciones, enlaces ni registros de transformaciones históricas. Sí registra identificador, checksum, fecha y modalidad de cada migración de esquema en `asvo_schema_migrations`. Cada archivo y su registro se confirman en una transacción. No requiere `APP_URL`, credenciales de Graph ni acceso a Microsoft 365.

## Nueva instalación local

```sh
npm run db:start
npm run db:setup
npm run db:seed:demo
# Opcionales:
npm run db:seed:calendar
npm run db:seed:groups
npm run db:seed:attendance
npm run dev -- --port 3031
```

Las fechas de los ejemplos son las fijadas en cada script. Las identificaciones legadas `DEMO…` sirven para esos ejemplos históricos, pero no cumplen el formulario público actual de nueve dígitos. Para probar ese formulario, usá una ficha ficticia de nueve dígitos y una póliza que cubra las fechas seleccionadas; no se cambió el contrato de inscripción como parte de esta etapa.

Los cuatro comandos demo exigen `ASVO_DEMO=1`, protocolo PostgreSQL y host literal `localhost`, `127.0.0.1` o `[::1]`. Se rechazan opciones de conexión que puedan sustituir el destino. La lista de parámetros locales admitidos es `sslmode`, `application_name` y `connect_timeout`. El registro CSV valida todos sus destinatarios `.test` antes de escribir. Los demás ejemplos usan direcciones `.test` definidas en código; no envían mensajes.

El registro demo reutiliza las personas por identificación y restablece su correo ficticio `.test` al repetirlo. No aplica ese cambio a otras personas de la base. Los ejemplos de asistencia existentes no se reescriben por conflicto de UUID; no se hace una limpieza masiva de ejemplos previos. El calendario conserva su comportamiento anterior de actualizar bloques coincidentes y registrar la carga en auditoría; repetirlo no duplica entidades, aunque conserva el registro de cada ejecución.

## Bases existentes y transformaciones históricas

Antes, `schema.sql` normalizaba unidades e inicializaba herencia, y `db.mjs` adaptaba inscripciones, creaba avisos/enlaces y podía despachar la cola. Ahora:

1. `scripts/db.mjs` usa el ejecutor numerado; `lib/database-setup.mjs` ofrece la misma entrada para scripts de prueba. La única fuente SQL del esquema es `migrations/*.sql`.
2. `scripts/db-history.mjs --apply` ejecuta las transformaciones de `scripts/historical-data/` y la adaptación de inscripciones.
3. La comunicación habitual sigue a cargo de las operaciones de aplicación y de la cola. No existe un anuncio histórico masivo implícito.

Para una base anterior, primero se consulta el plan: la adopción solo es posible si ya coincide con la baseline. Un esquema parcial requiere una actualización explícita revisada, no la repetición automática del SQL inicial. Después se revisan/aplican las transformaciones históricas necesarias **antes de habilitar los flujos que dependen de esos datos**. En esta etapa no se ejecutó ese procedimiento en la base beta.

| Marca | Transformación |
| --- | --- |
| `legacy-volunteer-units-v1` | Añade Voluntariado General, retira Otros de membresías/catálogo y valida la restricción de unidad general |
| `legacy-outing-defaults-v1` | Inicializa datos comunes desde el primer bloque cuando aún son nulos y conserva sus diferencias |
| `legacy-outing-photos-v1` | Inicializa fotos comunes y conserva fotos personalizadas según las banderas existentes |
| `received-registration-reservations-v1` | Marca original conservada: adapta el reparto histórico de inscripciones, conserva confirmadas y registra su auditoría |

Las primeras tres transformaciones conservan también sus condiciones anteriores por fila (`outing_defaults` y `outing_photos_initialized`); no vuelven a inicializar series ya preparadas. Cada transformación y su marca se confirman en la misma transacción, con el bloqueo asesor existente. Si falla una, no se registra su marca y se detiene el comando; las etapas anteriores confirmadas permanecen registradas y se omiten al reintentar.

La restricción de Voluntariado General se agrega como `NOT VALID` cuando todavía no existe: obliga a las escrituras nuevas sin reescribir ni validar silenciosamente los datos antiguos. El comando histórico corrige las membresías y valida esa restricción. Si una referencia antigua impide retirar «Otros», la transformación falla y revierte; no se inventa una unidad sustituta para las salidas.

La marca **`received-registration-reservations-v1` nunca se borra ni se renombra**. Si ya existe, la adaptación se omite incluso si se incorporan luego filas legadas. No se deben borrar marcas para forzar repeticiones. Las solicitudes por recuperar mantienen sus acciones normales de gestión.

La adaptación histórica ya no importa el generador de correo: no crea notificaciones, enlaces privados ni mensajes demo. Los mensajes, intentos, fechas y enlaces que ya existían permanecen intactos. Las razones de auditoría históricas describen el cambio de estado; no son evidencia de que se haya generado o enviado un correo en esta ejecución.

## Correo operativo sin cambios

- Recepción, edición, confirmación, cancelación, promociones y recordatorios conservan su generación transaccional de mensajes e intento posterior de envío.
- Se conserva el bloqueo de destinatarios `.test`, orden por inscripción, reserva concurrente y reintentos.
- `scripts/mail-outbox.mjs` sigue siendo la entrada explícita para el worker/reintento; no se importa desde la preparación ni desde el histórico.
- `/api/cron/correos`, su autenticación y su programación `0 12 * * *` no cambian. La bandeja demo sigue siendo el destino del modo local.
- La compilación y el arranque de Next.js no ejecutan estas operaciones de base.

## Verificación de esta etapa

`npm run test:db:commands` exige demo y servidor local en el proceso padre. Crea una base con nombre aleatorio `asvo_dbops_test_*`, verifica su identidad y dirige todos los comandos hijos a ella. No escribe fixtures en la base de la aplicación. Los hijos no reciben configuración Graph/Auth/SharePoint y usan un doble que rechaza toda petición `fetch` externa. Al terminar, incluso ante error, se cierra y elimina la base desechable. Requiere permiso local para crear bases.

Casos comprobados:

- Preparación nueva y repetida sin credenciales Graph ni `APP_URL`.
- Preparación con datos históricos: comparación de filas antes/después, sin transformaciones, notificaciones o enlaces implícitos.
- Rechazo de `--demo`, flags no autorizados y carga demo sin modo/destino permitido antes de escribir.
- Adaptación histórica de confirmada/revisión/espera y herencia de fotos, preservando la cola, mensajes demo y enlaces existentes.
- Repetición histórica sin nuevos registros ni auditorías y respeto de una marca de flujo ya aplicada.
- Ejemplos ficticios repetidos sin duplicar entidades, con destinatarios `.test`.
- Regresiones de inscripción y formularios de Coordinación en grupos independientes de `npm run test:integration`, cada uno con su base temporal.
- Pruebas independientes de cron, plantilla y bloqueo `.test`, sin proveedores reales.

El ejecutor numerado, checksums y plan/adopción ya están implementados y se prueban con `npm run test:db:migrations`. No se modificaron privilegios ni se adoptó la base beta. La recuperación, límites de compatibilidad e inventario están en la guía de migraciones.
