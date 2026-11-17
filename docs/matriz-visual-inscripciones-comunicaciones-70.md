# Matriz visual: inscripciones, comunicaciones y 70

17/11/2026. Base `3e0a187332414203201a53092acada85723abee3` más el diff local preservado. **393 observaciones CUA distintas: 193 desktop (1440×900), 200 celular (390×844), 323 capturas.** Rutas y consumidores reales, con sesión y datos demo locales. Se corrigieron dos fallos reproducidos; no se modificaron permisos, consultas de negocio, estados, cupos, espera, auditoría ni notificaciones.

La ejecución completa los casos locales descritos abajo. No declara completa la matriz superior ni convierte una variante en cobertura de todas las variantes de su familia. Las celdas amplias que aún incluyen casos no ejecutados permanecen pendientes en el JSON.

## Entorno, privacidad y evidencia

- Node **26.13.1**; PostgreSQL local **18.6**, no 18.7. Clúster nuevo en puerto 55529 y servidor Next en 3046. Se verificaron base y `data_directory` antes de preparar/escribir. No se copiaron `.env`, permisos ni credenciales beta.
- Copia temporal de app/lib/public, con componentes, rutas, consultas, autorización, casos de uso y transacciones reales. Coordinación general y unidad General ficticias; no se debilitó autorización. Los casos de otra unidad/permisos se comprobaron en integración, no mediante una sesión visual diferente.
- Los adaptadores de Server Actions de la **copia** introdujeron demora (1800ms; consultas 1400ms), respuestas incompletas/malformadas, error general con campos y rechazo **antes** del caso de uso. El reintento posterior ejecutó el servicio original y guardó en PostgreSQL. No son fallos de red posteriores al commit.
- Sin Graph ni correo externos: `fetch` bloqueado, `.test`, entorno demo y ninguna credencial. La cola real terminó vacía; las comunicaciones se registraron en la bandeja demo. No se probó entrega real ni aceptación Graph.
- Enlaces privados exclusivamente ficticios locales. URLs y valores largos redactados en AX/DOM/registro del servidor; no se tomaron capturas del campo que muestra un enlace privado. No se copiaron tokens a documentación ni a snapshots SQL. Capturas del informe muestran el cuerpo, no la barra de dirección.
- [Índice CUA](../tests/participation-visual/results.json), [observaciones](../tests/participation-visual/observations), [capturas](../tests/participation-visual/evidence), [snapshots SQL sin tokens](../tests/participation-visual/persistence.json). Cada observación conserva fecha, dimensión, AX, foco, controles, datos, asociaciones de errores, scroll y URL redactada. El nombre del archivo por sí solo no acredita aprobación.

## Recorridos ejecutados

Los prefijos `desktop-` y `mobile-` identifican las dos ejecuciones en el índice. Un intento sin respuesta confirmada se mantuvo abierto; las pruebas de `saved` incompleto no invocaron el servicio original.

| Consumidor / matriz | Evidencia nueva y resultado |
| --- | --- |
| **Agregar, M11** | `add-required/missing-status/invalid-status/mixed/rejection`, resumen a campo y doble clic demorado; conserva búsqueda/persona, fechas y transporte. Alta real **revisión y espera en ambos viewports**, según la respuesta/ocupación real. Escape bloqueado durante pending, recuperación y retorno al disparador. No se infiere revisión cuando falta status |
| **Editar, M12** | `edit-loading/malformed/mixed/rejection/committed`: consulta demorada, resumen navegable, errores generales y campos simultáneos, datos conservados, doble clic y reintento. Estado revisión/espera permanece según el registro. En Solicitudes móvil se editaron observaciones de una confirmada, sin cambiar su estado |
| **Gestionar de PDP, M10** | `assign`, `unassign`, `confirm`, `wait`, `reject`, `cancel`, `recover`: acciones reales, motivo requerido cuando corresponde, identificación de recuperación inválida/real, fallos y reintentos, asignar/quitar 70 y confirmación. Desktop recuperó una cancelada a confirmada; en móvil, la promoción FIFO ocupó el cupo y la reconfirmación conservó el error general de ocupación, sin forzar reglas |
| **Gestionar de Solicitudes, M09** | Desktop: detalle/historial demorado → Volver → cancelar con motivo → tres fallos → commit; desaparece del filtro Confirmada y enfoca la siguiente persona. Celular: Gestionar → Editar → fechas vacías, resumen → corrección → fallos → commit; filtros y origen conservados. Enter, Escape, encabezado de paso y traspaso al modal Editar verificados en ambos tamaños |
| **Gestionar de Resumen, M03** | Confirmación desde bandeja revisión, tres fallos y guardado real en ambos tamaños. Fila desaparece sin cambiar filtros. Regresión de doble clic después de la corrección enfoca el enlace de la siguiente fila; [foco después del arreglo](../tests/participation-visual/focus-after-fix.json) |
| **Crear desde agrupación, M17** | Título/cupo inválidos conjuntamente, destino ausente, mezcla general/campos, rechazo y reintento. Un nuevo grupo por viewport, dos inscripciones trasladadas, una conservada en el original; estados/fechas respetados. Se mantiene la página Herramientas y el enlace **Abrir la nueva salida**. Desktop abrió ese detalle real; no se inventó una navegación automática |
| **Invitación, M16** | Identificación requerida, éxito incompleto sin link, general/campo, rechazo, guardado y copia local ficticia en ambos tamaños. Dos invitaciones SQL, ninguna comunicación por generarlas |
| **Enlaces del 70, M41** | Responsable requerido, éxito sin link, error mixto, rechazo y generación real; revocación con respuesta malformada/general/rechazo y éxito real en ambos tamaños. Se conservó el link ante fallos y se retiró después del commit. Desktop comprobó la página de enlace revocado no disponible; móvil tiene evidencia SQL y servicio, no nueva navegación al enlace revocado |
| **Recordatorios, M04/M10** | Móvil desde Gestionar de PDP y desktop desde Resumen: vista previa, sin enlace vigente → preparar enlace y recordar, fallos, pending/Escape bloqueado, reintento y registro real demo. Reapertura con enlace vigente. Cruces desktop/PDP y móvil/Resumen: Enter, preview, Escape y foco de regreso. No se envió ningún mensaje |
| **Resumen y Logística, M02/M13/M14** | Criterios General, periodos 7/14/30 utilizados; bandejas revisión/informes y salidas consultadas. En ambos tamaños: Resumen → salida → Logística → transporte → persona → regreso al desglose; alimentación por separado → persona → regreso → salida → Resumen. Se conservaron periodo/unidad/pestaña y foco en origen. En móvil se reabrió el modal de desglose correcto; en desktop el disclosure. Los conteos mostraron un vehículo/dos espacios y una restricción ficticia |
| **Vista/informe del 70, M43** | Brief privado real; borrador incompleto con labores/tipo/host/acciones sin completar, errores simulados, reintento y SQL. Recarga mantiene edición. Finalización: seis correcciones, resumen revela labores/tipo/asistencia/confirmación; datos completados, fallos, reintento, commit y recarga bloqueada en ambos tamaños. Solo una de dos personas se marcó participante |

## Fallos reproducidos y correcciones mínimas

### Agrupación: resultado sin destino cerraba el modal

`desktop-split-false-close-reproduced` mostró que `{saved:true}` cerraba ActionModal sin haber creado nada (respuesta de transporte simulada). SplitGroupForm validaba destino solamente cuando ya existía, devolviendo el éxito incompleto al contenedor.

Ahora exige un destino no vacío **antes** de devolver el éxito. Si falta, devuelve error general y conserva el formulario; no reenvía automáticamente. Se verificó el arreglo en desktop/celular, seguido por errores independientes, rechazo y guardado real. No cambió FormResult, ActionModal ni el servicio/transacción de agrupación. Un resultado perdido después de un commit real seguiría siendo incierto: el texto indica revisar la lista antes de reintentar.

### Doble clic: se perdía la captura de posición del formulario

Al confirmar una inscripción desde Resumen, el segundo `pointerdown` podía llegar antes de que React deshabilitara el botón. El restaurador invalidaba la captura del primer submit; al desaparecer la fila, el foco quedaba en BODY. Instrumentación temporal confirmó el orden submit → segundo pointerdown → guardado sin captura; no era un cambio de filtros.

ListPositionRestorer conserva temporalmente la referencia al formulario enviado y no invalida por otro pointerdown **dentro de ese mismo formulario**. Errores, interacción fuera, teclado, wheel y popstate siguen invalidando. La referencia no se serializa ni guarda en sessionStorage. Pending/inFlight siguen impidiendo una segunda llamada desde el formulario.

Repetición sobre Resumen desktop/celular confirmó foco en la siguiente fila. Regresión compartida en Solicitudes: cancelación que desaparece y edición con errores/foco. Logística y cadenas multinivel conservaron su comportamiento. No se tocaron reglas de negocio ni el algoritmo de selección de vecinos.

## Persistencia local y efectos

Snapshot final: **14 salidas, 32 inscripciones, 2 informes, 2 invitaciones, 2 recordatorios, 57 eventos de auditoría, 39 mensajes demo**. No hay duplicados de pareja salida/persona. Las dos salidas separadas contienen dos miembros, capacidad dos, privadas y flexibles.

Los snapshots `desktop-draft` y `mobile-draft` capturan un informe borrador con `submitted_at=null`, host/acciones incompletos y ninguna asistencia marcada. El snapshot final muestra dos informes finalizados, cada uno con una persona que asistió y otra que no. El bloqueo posterior se verificó en UI tras recargar. La integración de transiciones verifica separadamente que un borrador no acredita asistencia; un snapshot de participantes sin marcar no sustituye esa regla de dominio.

Los dos recordatorios usan `.test`, `demo=true`, `queued=false`. La cola real tiene **cero filas/cero sent_at**. Los dos enlaces revocados permanecen revocados; el recordatorio posterior crea un enlace nuevo vigente según el flujo existente. El snapshot no conserva hashes ni tokens.

## Comprobaciones y reproducción

Resultados: [static](../tests/participation-visual/checks-static.json), [seis grupos SQL](../tests/participation-visual/checks-sql.json), [dos grupos adicionales](../tests/participation-visual/checks-sql-extra.json).

| Comprobación | Resultado |
| --- | --- |
| TypeScript, contratos, lint, formato administrado | Correctos con Node 26.13.1 |
| Suite unitaria aislada | 108/108 |
| Build Webpack/HTTP de seguridad aislado | Correcto; cabeceras, Auth.js, cron y rechazo server-only; sin DB/proveedores |
| Integración | staff-registration-results, staff-forms, workflow-transitions, functional-actions, brief-contracts, authorization, registration-decision-contracts y summary: ocho grupos correctos, bases retiradas |
| Nuevas regresiones de consumidores/efectos | 7/7: callback real de SplitGroupForm y efectos reales del restaurador con fronteras UI/DOM simuladas. No son unitarias puras ni CUA |
| Regresión DOM previa de foco | 7/7 de tests/manage-focus/restore-focus.test.mjs |
| Verificación offline de evidencia | 3/3: dimensiones/desbordamiento/redacción, borrador/final, relaciones/efectos finales. No sustituye ejecutar navegador |

Comandos desde la raíz con el Node fijado en PATH:

```sh
node --import ./tests/participation-visual/register.mjs --test tests/participation-visual/regressions.test.mjs
node --import ./tests/manage-focus/register.mjs --test tests/manage-focus/restore-focus.test.mjs
node --test tests/participation-visual/evidence.test.mjs
node tests/participation-visual/checks.mjs static
```

`fixture.mjs` requiere el runtime PostgreSQL nativo local ya instalado bajo `.local-postgres/runtime`, comprueba un clúster nuevo y lo retira al recibir SIGTERM. No utiliza `.env`. `checks.mjs sql` y `sql-extra`, y `snapshot.mjs`, requieren ese fixture activo y validan su destino local. CUA sigue siendo interactivo: no se declara runner autónomo de CI. Los registros actuales son evidencia de esta revisión, no una promesa de cobertura ante cualquier diff futuro.

## Incidencias y límites explícitos

- Primera preparación falló por un espacio faltante en SQL del fixture; se corrigió el fixture y se eliminó ese clúster. El primer comando sql-extra estaba mal construido; se corrigió el runner y ambos grupos pasaron. No son defectos de la aplicación.
- Un tab del navegador integrado expiró y se creó otro; no se continuó con handles obsoletos. Algunas esperas de selector terminaron antes de completar la carga; se inspeccionó el estado y no se repitió automáticamente la mutación. La apertura inicial con URL de redirección fue lenta; la recuperación utilizó about:blank y navegación posterior.
- En campos controlados, `.fill()` ocasionalmente no provocó el estado React; se confirmó entrada con teclado y se verificaron valores/SQL. No se atribuye al producto ese comportamiento del controlador.
- `mobile-reconfirm-malformed/mixed/rejection` son nombres engañosos del arnés: el contador de Confirmar ya estaba consumido y esas tres respuestas eran el **conflicto real de cupos**. No se cuentan como malformadas. Usar `mobile-reconfirm-full-conflict` como evidencia de ese caso.
- `desktop-final-response-inspect` es transitorio; el resultado final se demuestra con `final-committed`, `final-locked-reload` y SQL. No equiparar una captura pending con un estado estable.
- Los 393 registros no muestran desbordamiento horizontal en los tamaños probados. No se midió de nuevo todo el contraste, zoom, forced-colors, teclado exhaustivo o área táctil de cada control; distribución amplia queda parcial.
- General+unidad ficticias: no nueva CUA de roles Admin/otra unidad, todos los permisos o todos los estados en **cada una** de las tres listas. M09 y M03 mantienen variantes cruzadas pendientes. No se fuerzan campos en acciones que no los tienen.
- Pendientes: barrido exhaustivo Tab/Shift+Tab/descarte de cada consumidor, cambios de fechas que vuelven a revisión, enlaces expirados móvil y fallo de portapapeles, datos vacíos completos, Atrás/Adelante/recarga/pestañas distintas de cada recorrido tras el cambio compartido, e informe consultado desde el desglose staff M42. La evidencia histórica de navegación/contratos permanece identificada, sin presentarla como repetición nueva.
- Lectores de pantalla **hablados**, dispositivos físicos, otros motores y pruebas de infraestructura permanecen en matrices independientes. AX/ARIA y foco observado no equivalen a lectura hablada.
- Repetir SQL con PostgreSQL **18.7**. No se alteraron versiones de Vercel/Neon ni proveedores. No se publicó, desplegó ni subió a GitHub.

Los fixtures activos, clúster, copia de Next y pestaña se retiraron. Se conservan scripts de reproducción y evidencia ficticia redactada.
