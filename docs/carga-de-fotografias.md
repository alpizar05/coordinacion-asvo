# Carga de fotografías sin bloqueos durante Graph

## Flujo y límites de responsabilidad

Las acciones de creación, edición conjunta y gestión de fotos usan `withPhotoUploads` (`lib/photo-upload-workflow.ts`). Las funciones de persistencia reciben imágenes ya preparadas y referencias; no llaman a Graph.

1. Una transacción consulta metadatos y permisos vigentes antes de leer el contenido del archivo. El endpoint de fotos también autoriza con metadatos antes de consultar los bytes.
2. Fuera de transacción, Sharp comprueba y prepara cada archivo. Se acumulan errores por fotografía y se conservan sus claves en el contrato compartido de formulario.
3. Una transacción corta valida reglas, seis fotos como máximo, permisos de fuentes, herencia y versión. No crea convocatorias ni modifica fotos durante esta prevalidación.
4. Se reclama un intento con una concesión de diez minutos. Antes de cada PUT se registra una ruta única en PostgreSQL. Token, PUT, consulta y DELETE de Graph se ejecutan sin transacción abierta.
5. Una transacción corta vuelve a comprobar concesión, permisos, versión y límites. Confirma referencias, auditoría y resultado juntos. Las fotos no utilizadas quedan pendientes de compensación.

Los servicios existentes conservan portada, orden, descripción, crédito, autorización, galería y personalización/herencia de bloques. En modo demo se guardan las versiones optimizadas locales sin Graph. Las fotos existentes o seleccionadas de galería nunca se registran como originales nuevos que deban compensarse.

## Reintento e incertidumbre

Los formularios envían un identificador de intención mantenido en memoria React. Un resultado confirmado queda registrado y un reintento con el mismo contenido devuelve ese resultado, sin duplicar referencias ni auditoría. El contenido se vincula a la intención mediante una huella de metadatos y bytes. Reutilizar una intención ya confirmada con otros datos exige recargar; una intención fallida permite corregir los datos y reintentar. Los clientes antiguos sin identificador conservan compatibilidad, pero no tienen deduplicación entre peticiones independientes.

Los archivos y sus metadatos preparados permanecen en el estado del formulario tras errores; no se agregan a localStorage. La preparación en memoria del servidor se repite al reintentar. Dos peticiones simultáneas de la misma intención no cargan juntas. Una concesión vencida impide confirmar un intento tardío. Si se pierde la respuesta del COMMIT, se consulta el resultado persistido antes de compensar.

No se promete atomicidad entre PostgreSQL y SharePoint. La bitácora durable permite recuperar una caída de proceso o una carga con resultado incierto. Un PUT que vence puede terminar tarde: un 404 posterior no demuestra que no aparecerá el archivo. Su ruta sigue pendiente y se consulta nuevamente; no hay caducidad automática que descarte esa incertidumbre.

## Limpieza compensatoria

Solo se consideran rutas generadas por este flujo. Se consulta la ruta exacta, se verifica carpeta, nombre, identificador y eTag; se elimina con `If-Match`. Antes del DELETE se comprueban referencias en `outing_photos`, `request_outing_photos` y, si existe, la tabla histórica de fotos. También cuentan referencias inactivas: retirar una foto del portal no autoriza a borrar su original.

Los triggers de `0002_photo_upload_lifecycle.sql` impiden agregar referencias normales a un archivo que ya está en limpieza o eliminado. La decisión se serializa mediante la fila de la bitácora; la llamada externa queda fuera de transacción. Un original referenciado pasa a protegido y se conserva. Esto es compensación de cargas nuevas, no recolección general de fotos antiguas.

La compensación inmediata es de mejor esfuerzo. Si falla la base o Graph, queda pendiente. Una ejecución procesa hasta 30 elementos vencidos. Los fallos conocidos se reintentan después de cinco minutos; los PUT inciertos y las concesiones abandonadas tienen quince minutos de espera. Las filas históricas existentes se inspeccionan, pero no se admite que una herramienta externa escriba referencias manualmente durante una limpieza: debe usar las tablas y políticas de la aplicación.

Comandos explícitos, con entorno local cargado por npm:

- `npm run photos:cleanup:plan`: consulta conteos por estado, sin Graph ni escrituras. No realiza una simulación de referencias ni de disponibilidad del proveedor.
- `npm run photos:cleanup`: procesa compensaciones vencidas. Este comando sí puede eliminar originales no referenciados; requiere revisar el destino y credenciales antes de usarlo.
- Con variables ya inyectadas: `node scripts/photo-cleanup.mjs --plan` o `--apply`.

No se agregó cron ni automatización externa. Para recuperar caídas debe ejecutarse la limpieza explícita; sin esa ejecución, las compensaciones abandonadas permanecen registradas. No se realizó limpieza real en esta etapa.

## Migración y despliegue

Es obligatorio aplicar la migración numerada **0002_photo_upload_lifecycle** antes de desplegar estas acciones. Es aditiva: no cambia originales, referencias ni datos existentes, ni necesita Graph. Usar primero estado/plan y el procedimiento de adopción cuando corresponda, según [migraciones numeradas](migraciones-numeradas.md). No modificar ni volver a generar la baseline 0001. No se ejecutan migraciones al compilar o iniciar Next.js. Las pruebas se ejecutaron sin modificar la beta. En la publicación autorizada posterior se verificó y adoptó la baseline compatible de Neon y se aplicó 0002, sin transformaciones históricas ni comunicaciones.

## Comprobaciones reproducibles

`npm run test:integration -- --only=photo-uploads` crea una base local desechable, usa imágenes sintéticas y el adaptador real de proveedor con fetch Graph simulado. Verifica autorización antes de bytes, NOWAIT durante IO externo, errores por archivo, permisos revocados, cambios de versión, límites concurrentes, fallos tras PUT, reintentos, COMMIT incierto, timeout y carga tardía, limpieza fallida, protección compartida y bloqueo de referencias durante DELETE, creación de series y restauración de herencia. No envía correos ni realiza cargas reales.

La suite `schema-migrations` verifica además aplicar 0002 sobre una baseline adoptada, conservación de datos y repetición sin cambios. Las suites de autorización y formularios conservan sus casos de acceso público, capacidades privadas, validación y herencia. TypeScript, unitarias y compilación complementan estas pruebas. No se hizo una prueba visual nueva de navegador ni una prueba real de SharePoint; la conservación de Files se comprueba por estado/contrato y pruebas del FormData sin mutación.
