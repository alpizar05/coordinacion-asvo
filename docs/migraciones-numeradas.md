# Migraciones numeradas y adopción de bases existentes

Estado: implementado y verificado únicamente en PostgreSQL local desechable. No se accedió a beta, Graph ni proveedores; no se publicó. Esta etapa continúa la separación entre estructura, transformaciones históricas, datos demo y correo.

## Fuente de verdad e inventario

La fuente de verdad es `migrations/*.sql`, comenzando por **`0001_initial.sql`**: el esquema completo que antes residía en `schema.sql`. El archivo raíz fue retirado; no hay una segunda copia SQL mantenida en paralelo. Se conserva la estructura de la etapa anterior, incluido el catálogo de referencia; no se reconstruyen supuestas migraciones anteriores ni sus fechas.

Inventario de la baseline:

| Grupo | Objetos |
| --- | --- |
| Acceso y catálogo | `grants`, `units` |
| Voluntariado | `volunteers`, `policies`, `volunteer_incidents` |
| Convocatorias y series | `requests`, `outings`, `outing_collections`, `outing_collection_members`, `homepage_feature` |
| Fotografías | `outing_photos`, `request_outing_photos` |
| Inscripciones y acceso privado | `registrations`, `links`, `attempts`, `registration_receipts`, `outing_invitations` |
| Comunicaciones | `demo_mail`, `registration_mail_outbox`, `report_reminders` |
| Informes y asistencia | `outing_brief_links`, `outing_reports`, `attendance_resolutions` |
| Evidencia e historial | `audit`, `app_migrations` |

En total: 25 tablas, 201 columnas entre tablas/vista, 75 restricciones distintas de NOT NULL, 38 índices, cinco secuencias de identidad, la vista `volunteer_attendance_evidence` y la función `attendance_resolution_is_current`. NOT NULL se verifica mediante las columnas: PostgreSQL 18 también lo presenta como restricción en el catálogo, mientras versiones anteriores no lo hacen.

Los únicos datos de referencia insertados por la baseline son las cuatro unidades operativas: Voluntariado General, UEA, Control y Protección/COVIRENA y BRIF. No incluye personas, permisos demo, salidas, notificaciones ni enlaces.

Las transformaciones históricas siguen fuera de la secuencia de esquema:

- `scripts/historical-data/volunteer-units.sql`: normalización y validación de membresías.
- `scripts/historical-data/outing-defaults.sql`: datos comunes y diferencias de bloques.
- `scripts/historical-data/outing-photos.sql`: fotos heredadas y personalizaciones.
- `lib/registration-workflow-migration.mjs`: adaptación histórica de cupos/estados.

Se ejecutan solo mediante `db:migrate:history -- --apply`, conservando sus marcas en `app_migrations`. Aplicar o adoptar el esquema no ejecuta ninguna de ellas ni modifica sus marcas o mensajes existentes.

## Registro y ejecución

`asvo_schema_migrations` es un registro independiente:

- `id`: nombre completo, por ejemplo `0001_initial`.
- `checksum`: SHA-256 de los bytes del SQL; los archivos se mantienen con finales LF mediante `.gitattributes`.
- `applied_at`: momento real de aplicación o adopción, no una fecha histórica inventada.
- `mode`: `applied` para SQL ejecutado o `baseline` para adopción verificada.

Los nombres usan cuatro dígitos y descripción: `0002_descripcion.sql`. No puede repetirse un número. El historial debe ser un prefijo de los archivos disponibles; se rechazan archivos aplicados ausentes, checksums diferentes, cambios de orden y modalidades inválidas. Nunca se actualiza un checksum registrado para ocultar diferencias. Una migración aplicada se trata como inmutable: los cambios siguientes requieren otro archivo.

Un bloqueo asesor **de sesión**, sobre una conexión reservada, cubre toda la operación de aplicación/adopción. Es la misma clave usada por las transformaciones históricas, de modo que los ejecutores cooperantes no se pisan. La espera está limitada a 15 segundos; un timeout debe reintentarse después de revisar el proceso que mantiene el bloqueo. La conexión libera el bloqueo en `finally`; PostgreSQL también lo libera si se pierde la sesión.

Cada archivo y su registro se ejecutan dentro de una misma transacción. Si falla una migración, se revierte su DDL/DML y no se registra; las anteriores ya confirmadas permanecen. Este diseño permite reintentar sin repetir los pasos confirmados.

**No se admiten excepciones no transaccionales automáticamente.** El ejecutor rechaza control explícito de transacciones y operaciones como `CREATE INDEX CONCURRENTLY`, `VACUUM`, creación de bases o `ALTER SYSTEM`. Si una futura operación requiere salir de una transacción, debe diseñarse y revisarse un procedimiento separado con su propio control de concurrencia y recuperación; no se añade una opción para saltarse silenciosamente las garantías. Actualmente no hay migraciones no transaccionales.

## Estado y plan sin escrituras

```sh
npm run db:status
npm run db:plan
```

Ambos devuelven JSON mediante una transacción `REPEATABLE READ READ ONLY`. No crean el registro ni la baseline, no reparan objetos y no consultan fichas o contenido de mensajes. La salida contiene identificadores/checksums/fechas y diferencias de catálogo o referencias operativas.

- `kind: empty`: base/esquema vacío, puede aplicar la secuencia.
- `kind: existing`: objetos existentes sin historial numerado; incluye compatibilidad y diferencias para adopción.
- `kind: tracked`: historial registrado y migraciones pendientes.

Estado y plan comparten inspección: no simulan SQL pendiente ni prometen detectar errores de una migración antes de ejecutarla. En una base registrada verifican archivos/checksums/secuencia; **no son una auditoría completa de deriva manual del esquema actual**. La comparación estructural completa se usa para adoptar la baseline.

## Base vacía

```sh
npm run db:migrate
# db:setup es la misma entrada compatible.
```

Ejecuta los SQL pendientes y registra sus metadatos. Una segunda ejecución no repite la baseline ni transforma datos incorporados después. No necesita Graph ni `APP_URL`.

## Adopción explícita

```sh
npm run db:plan
# Solo cuando el plan indica compatibilidad y el destino fue revisado:
npm run db:adopt -- --apply
npm run db:migrate
```

Una base existente sin registro **no recibe el SQL inicial automáticamente**, aunque ese archivo contenga `IF NOT EXISTS`. La adopción compara:

- Tipos de relación, persistencia y configuración RLS y opciones de relación.
- Columnas, tipos, collation, nullabilidad, identidad, generación y expresiones predeterminadas.
- Restricciones, claves primarias/foráneas, unicidad, checks y diferibilidad.
- Definiciones/predicados de índices y su estado válido/listo.
- Vista, función, secuencias y sus referencias de propiedad.
- Triggers y políticas adicionales en tablas administradas.
- Presencia de las cuatro unidades de referencia.

Acepta la restricción de Voluntariado General ya validada, que es más fuerte que su versión `NOT VALID` en la baseline. Las tablas adicionales del importador histórico y los índices adicionales válidos no únicos se conservan; columnas, restricciones u otros cambios no verificados sobre objetos administrados causan rechazo. No elimina «Otros» ni inspecciona personas para normalizarlas. La compatibilidad de esquema no acredita que todos los datos históricos hayan sido conciliados.

La verificación es conservadora: expresiones equivalentes que PostgreSQL describa de otra manera pueden requerir revisión. Se probó en PostgreSQL 18 local; no se accedió a Neon ni se ejecutó una matriz entre versiones. Propietarios, ACL y permisos efectivos no se adoptan ni se modifican como parte de esta comprobación.

Tras verificar, se bloquean las tablas principales contra DDL incompatible y se vuelve a comprobar dentro de la transacción de adopción. Se registra **solo `0001_initial`**, sin ejecutarla. Los archivos posteriores siguen pendientes, aunque existan en el repositorio. Las marcas históricas, datos, cola, enlaces y herencia permanecen intactos. Para la adopción debe mantenerse una ventana sin DDL manual externo; el bloqueo asesor coordina estos ejecutores, no herramientas que ignoren su protocolo ni cambios independientes de funciones.

Si falta un objeto o es incompatible, el comando informa las diferencias y no escribe una marca ni intenta repararlo. Un esquema antiguo parcial requiere una actualización revisada explícita antes de poder adoptar esta baseline; no hay `--force` ni opción para marcar todo como aplicado.

## Catálogo generado de precondiciones

`migrations/0001_initial.schema.json` es **metadato derivado**, no otra versión del esquema. Se genera aplicando el SQL inicial en una base local nueva y extrayendo el catálogo; contiene su checksum fuente y ninguna ficha personal. El ejecutor rechaza un catálogo cuyo checksum no corresponda al SQL.

```sh
node --env-file=.env.local scripts/generate-baseline-catalog.mjs
```

Exige demo local, crea una base aleatoria y la elimina incluso ante error. No editar manualmente el catálogo. Antes de la primera publicación de esta baseline puede regenerarse para revisar cambios de representación; después de aplicarse su SQL es inmutable. Las futuras migraciones no se incorporan reescribiendo la baseline.

## Puntos de entrada revisados

- `scripts/db.mjs`: flags explícitos para aplicar, estado, plan y adopción.
- `lib/database-setup.mjs`: delega al mismo ejecutor para scripts.
- `scripts/import-historical-beta.mjs`: su rama local `IMPORT_TEST_SCHEMA` usa ese ejecutor sobre el esquema de prueba, en lugar de ejecutar `schema.sql` directamente. No se ejecutó la importación beta.
- `historical-import.sql`: conserva solo tablas de staging; la definición de `registrations.received_at` queda exclusivamente en la migración del esquema central.
- Generador/pruebas: ejecutan deliberadamente la baseline SQL en bases desechables para construir el catálogo y simular instalaciones anteriores sin registro. Son las únicas excepciones de preparación de fixtures.
- Next.js no importa el ejecutor en sus flujos de arranque. Los módulos exportan funciones sin abrir conexiones ni migrar durante importación, inicio o compilación.

## Fallos y recuperación

1. Consultar estado/plan y el error original. No borrar registros ni transformar checksums para forzar una repetición.
2. Si cambió un archivo aplicado, recuperar sus bytes originales desde control de versiones. El cambio deseado va en un nuevo archivo.
3. Ante fallo de una migración, su transacción se revierte; corregir el SQL **no aplicado** o sus precondiciones y reintentar. Las anteriores permanecen confirmadas.
4. Si una operación ya confirmada necesita corrección, preparar una migración posterior o restauración respaldada, según el caso.
5. Ante adopción rechazada, revisar diferencias y acordar una actualización compatible. No sustituir el chequeo por la existencia de tablas.

No hay rollback destructivo automático ni un comando `down` genérico. Una restauración puede perder escrituras posteriores: requiere un respaldo y un procedimiento específico. Nada de esta guía autoriza operar sobre beta sin la instrucción correspondiente.

## Verificación local

```sh
npm run test:db:migrations
npm run test:db:commands
npm run check
npm run build
```

Las suites exigen demo/destino local en el proceso padre, crean bases `asvo_migrations_test_*` o `asvo_dbops_test_*` y las eliminan al finalizar. Los fixtures nunca se escriben en la base de la aplicación. No hay correos ni llamadas Graph reales.

Verificados: vacío/estado/plan sin registro, segunda ejecución, catálogo compatible y adopción de solo la baseline, incompatibilidades de columna/default/FK/índice/función/referencia, checksum alterado, fallo intermedio con rollback de DDL/datos/marca y reintento, dos ejecutores simultáneos, esquema local de importación separado de `public` y conservación de marcas históricas/cola/enlaces. La regresión de la etapa anterior conserva las pruebas de permisos, versiones, cupos, espera, formularios y correo simulado.
