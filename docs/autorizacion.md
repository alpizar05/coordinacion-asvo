# Políticas de autorización de ASVO

Etapa local de refactorización, 12 de noviembre de 2026. Conserva los permisos efectivos de la aplicación: no convierte Administración en Coordinación ni agrega acceso institucional a voluntariado mediante rol. No modifica Entra, Exchange, SharePoint ni PostgreSQL del despliegue.

## Fuentes verificables

- `lib/authorization.ts`: matriz ejecutable `authorizationMatrix`, decisión `allows`, alcance `staffScope` y decisiones de acceso a fotos. Operaciones desconocidas y usuario sin sesión se rechazan.
- `lib/auth.ts`: obtiene la identidad de la sesión y consulta `grants` en servidor. Reexporta `canOperate` y `canAdminister` para los consumidores existentes; ambos delegan en la política compartida.
- `lib/authorization-sql.ts`: condiciones parametrizadas de propiedad de colecciones, invitaciones, enlaces de gestión y enlaces del 70. La vigencia, revocación, uso y asignación se verifican en PostgreSQL, sin confiar en un reloj del navegador.
- `tests/authorization/entrypoints.mjs`: inventario de las 42 acciones/handlers en 16 archivos. `npm run test:authorization:inventory` falla ante un archivo/exportación sin clasificar o una operación desconocida. El inventario detecta omisiones; no demuestra por sí solo que una función autorice correctamente.

Los roles se suman únicamente cuando hay concesiones explícitas. Los permisos de unidades no se obtienen de los campos de un formulario. Los identificadores y unidades del recurso se consultan en servidor; en mutaciones se mantienen los bloqueos y las comprobaciones posteriores existentes.

## Matriz de rol, unidad y recurso

“Unidad propia” significa una concesión `unidad` exactamente igual a la unidad actual del recurso. Administración sola no tiene permisos implícitos de operación.

| Operación / recurso | Administración sola | Coordinación general | Coordinación por unidad | Comprobación del recurso |
| --- | --- | --- | --- | --- |
| Administración y permisos de aplicación | Sí | No | No | Rol admin; se mantiene la prohibición de revocar el propio admin |
| Registro maestro y ficha de voluntariado | Sí | Sí | No | Persona existente; no se amplía por tener una inscripción de su unidad |
| Corregir ficha, verificar póliza, importar voluntariado/pólizas | Sí | No | No | Identificador válido, recurso existente y validaciones/versiones anteriores |
| Actualizar unidades de una persona | Sí | Sí | No | Solo unidades del catálogo; Voluntariado General siempre se conserva |
| Registrar incidente | No | Sí | No | Persona y vínculo con salida cuando se indica |
| Resumen, listados de salidas, inscripciones e informes | No | Todas | Unidad propia | Consultas filtradas por el alcance calculado en servidor |
| Consultar/crear/editar salida o gestionar inscripción | No | Todas | Unidad propia | Unidad actual de la salida; al cambiarla se valida también la unidad destino |
| Conciliar asistencia, recordatorios e invitaciones | No | Todas | Unidad propia | Inscripción/persona de esa salida, evidencia y estado actuales |
| Generar/revocar enlace de resumen del 70 | No | Todas | Unidad propia | Inscripción de la salida, confirmada y asignada como 70; estados admitidos |
| Adjuntar/editar/reutilizar fotos | No | Todas | Unidad propia | Permiso en la salida destino y en la unidad de la foto fuente; foto vigente |
| Leer serie automática | No | Todas | Bloques de unidad propia | Al menos un bloque visible; se conserva el filtro SQL sobre los bloques |
| Editar datos comunes / destacar serie | No | Todas | Solo si gestiona todos | Lista no vacía, autorización de todos los bloques y de unidad destino cuando corresponda |
| Crear serie manual | No | Sí | Sí | Todas las salidas seleccionadas deben pertenecer al alcance autorizado |
| Leer serie manual | No | Todas | Propietario | Además de ser coordinador, debe haber creado la serie; sus miembros siguen filtrados por unidad |
| Bandeja demo | No | Sí | No | Solo entorno demo |

Se conserva la distinción anterior de `canOperate(user)` sin unidad: significa Coordinación general, no “tiene cualquier rol de coordinación”. No se normalizan ni migran concesiones históricas: las consultas conservan las unidades almacenadas, incluida una concesión vacía si ya existiera. La asignación de nuevos permisos mantiene su validación de catálogo.

## Capacidades sin sesión de personal

| Recurso / operación | Capacidad requerida |
| --- | --- |
| Catálogo público | Abierta, listada y plazo de inscripción vigente; SQL existente sin cambios |
| PDP y foto por enlace directo | Abierta y plazo vigente; `listed=false` oculta del catálogo, no exige sesión |
| PDP/foto fuera del plazo o salida confirmada | Invitación vigente para esa salida o recibo vigente ligado a una inscripción de esa salida |
| Inscribirse mediante invitación | Además de la invitación no utilizada, debe corresponder a la persona invitada; siguen las reglas de unidad, correo y póliza |
| Gestionar inscripción privada | Token de gestión/validación vigente ligado a la inscripción; estados y acciones admitidos en servidor |
| Resumen/informe del 70 | Token vigente, no revocado, inscripción de esa misma salida, confirmada y actualmente asignada como 70; salida abierta, confirmada o completada |
| Guardar informe del 70 | Se repite la comprobación dentro de la transacción; finalizado permanece bloqueado |
| Cron de correo | Secreto Bearer comparado de forma segura y entorno habilitado; no se sustituye por un rol de personal |
| Endpoints de autenticación | Protocolo de Auth.js/Entra existente; identidad y directorio del token sin cambios |

Los tokens se comparan mediante digest y conservan el formato generado de 43 caracteres. Se mantienen las diferencias históricas de lectura/gestión y sus mensajes; no se restringen retroactivamente los propósitos de lectura. `allowsPhoto` solo recibe banderas de invitación/recibo después de verificarlas mediante las consultas de servidor; no acepta esas banderas desde el navegador como prueba de acceso.

## Dónde se comprueba

- **Server Actions de registro:** `app/staff-actions.ts` valida roles para ficha, póliza, importación, unidades, incidentes y permisos. Las acciones nuevas de inscripción, conciliación, recordatorios y resumen del 70 usan operaciones explícitas de la matriz. Las ramas y adaptadores anteriores de gestión siguen usando los helpers compatibles, que delegan en la misma matriz.
- **Servicios de salida:** editor, decisiones, agrupaciones y gestión de inscripción reciben la comprobación de unidad del usuario autenticado. Se conserva su revalidación tras cargar/bloquear el recurso, incluidos origen/destino, fotos fuente y todos los bloques de datos comunes. Esos servicios internos no son endpoints ni sustituyen la autenticación del adaptador público.
- **Consultas y páginas:** Resumen, listados de convocatorias/inscripciones/informes, formulario nuevo, series y galería obtienen `general` y `units` de `staffScope`. Las consultas filtran filas antes de mostrarlas. Ficha/registro maestro y Administración mantienen su control independiente del layout. Las consultas auxiliares de trayectoria, historial, resumen e informes se llaman después de autorizar su página/acción; no son APIs públicas.
- **Route Handler de fotos:** comprueba salida/foto activa y capacidad pública, invitación, recibo o permiso de la unidad. Denegación responde 404 sin bytes en la respuesta. Se conserva la consulta que recupera metadatos y bytes juntos; mover la autorización antes de recuperar bytes sigue como tarea separada de rendimiento/privacidad en TODO.
- **Enlaces privados:** página privada, servicio de edición/cancelación, lectura del resumen y escritura de informe usan formato y predicados compartidos. Las verificaciones sensibles siguen en SQL dentro del flujo de servidor, no en el layout ni en un botón oculto.

## Sesión y alcance por petición

No hay caché global de usuario ni de permisos, `unstable_cache`, almacenamiento de navegador o memoización entre peticiones. Cada acción llama a `staff()` y conserva ese usuario en su variable local; las decisiones posteriores y callbacks pertenecen a esa operación. Las comprobaciones del recurso siguen en las transacciones existentes. Reducir las consultas repetidas entre layout/página continúa como tarea independiente; no se declaró implementada una optimización de caché.

## Pruebas y evidencia

```sh
npm run test:authorization:inventory
npm run test:unit:coverage
npm run test:integration -- --only=authorization
npm run test:integration
npm run check
npm run build
```

- 72 unitarias correctas. Caracterización de los predicados anteriores en 64 combinaciones de concesiones y seis unidades/ausencia de unidad; matriz, operaciones desconocidas, roles acumulados, propiedad, todos los bloques y capacidades de fotos. Se mantiene la suite aislada de navegación.
- 13 grupos de integración y tres comprobaciones de contrato/inventario correctos. El nuevo grupo importa y ejecuta las Server Actions y el GET de fotos reales contra una base PostgreSQL local desechable. Sustituye únicamente APIs de petición/revalidación/redirección de Next y el transporte de autenticación, no los permisos, consultas, transacciones ni políticas.
- Llamadas directas sin sesión, otra unidad y admin sin coordinación; rechazo de corrección/póliza/importación/permisos por coordinación; foto fuente no autorizada y serie con bloques de otra unidad. Las operaciones permitidas siguen guardando y Voluntariado General no se elimina.
- Foto pública no listada, permiso de unidad correcto, invitación vigente/usada/vencida, recibo vigente/vencido/de otra salida; enlace del 70 con recurso cruzado, revocado, vencido o asignación retirada; mutación privada vencida. Dos peticiones simultáneas con usuarios distintos y otra anónima no comparten identidad; los cambios de concesión se leen en una petición posterior.
- TypeScript, compilación y `git diff --check` correctos. El ejecutor elimina las bases temporales; no se accede a beta ni a proveedores, ni se envían mensajes reales.

Las pruebas directas se ejecutan en Node 25; el loader usa `stripTypeScriptTypes` en modo `transform` para las propiedades de constructor existentes y conserva el código real. Esa API genera una advertencia experimental en Node. No reemplaza una prueba HTTP de extremo a extremo con una sesión Entra real, ni una prueba de penetración o revisión de privilegios efectivos de proveedores. El inventario cubre todas las exportaciones actuales; las llamadas directas representativas y suites existentes no equivalen a probar cada combinación de cada función. No se cambiaron reglas de negocio, esquema ni permisos externos.
