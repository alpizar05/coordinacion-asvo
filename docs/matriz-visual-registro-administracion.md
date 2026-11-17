# Matriz ejecutada: registro, asistencia y Administración

17 de noviembre de 2026. Ejecución local de M15, M32–M35 y M37–M39 de la [matriz de consumidores](matriz-visual-consumidores.md). Sin beta, proveedores, correo, cargas externas, publicación ni GitHub. El diff previo se conservó.

Balance de las 192 celdas de estos ocho recorridos y dos tamaños: **143 verificadas, 32 no aplicables y 17 pendientes**. Los pendientes no se presentan como cobertura completa de la familia.

## Método y revisión

Se abrieron **las rutas de ficha, salida y Administración reales**, no réplicas de sus formularios. Se conservaron layout, navegación, sesión demo, `staff`, políticas, consultas, validaciones, servicios, transacciones y SQL. Una copia desechable añadió un inicio de sesión de prueba que solo fija la cookie demo existente y adaptadores de respuesta: primer intento autorizado devuelve general + campos, segundo rechaza antes de persistir, tercero llama a la acción original. Cada intento se demora 1,8 s. Las denegaciones siguen delegando en la autorización original. No se cambiaron permisos para habilitar controles.

- CUA/IAB: desktop **1440×900** y celular emulado **390×844**. 201 observaciones, no 201 recorridos independientes; 59 capturas.
- Node **26.13.1**, npm **11.7.0**. PostgreSQL disponible **18.6**: clúster nuevo en directorio temporal, puerto reservado 55527, verificado mediante `data_directory` antes de escribir. **No acredita PostgreSQL 18.7**, que permanece pendiente como comprobación de runtime.
- Sin archivos dotenv ni credenciales de proveedores. Fetch externo bloqueado. Solo personas, pólizas, informes, concesiones y destinatarios `.test` ficticios.
- Base de revisión: `3e0a187332414203201a53092acada85723abee3` más diff local. [Hashes finales](../tests/registry-visual/revision.json); el JSON principal conserva también los hashes de la preparación anterior.

Separación de evidencia: los errores inyectados son **C** (consumidor real, respuesta simulada); el guardado final y la lectura SQL son **L**. La regresión del informe del 70 es C exclusivamente: no usa capacidad privada válida ni persiste informes. No se confunde aceptación visual con commit.

## Resultados por recorrido

| Matriz / recorrido | Desktop y celular: evidencia nueva | Persistencia comprobada |
| --- | --- | --- |
| M32 Corregir ficha | `*-profile-*`: campos obligatorios, general+correo/WhatsApp, resumen, corrección independiente, rechazo, doble clic, teclado, Escape, descarte y disparador | Dos correcciones auditadas; WhatsApp final ficticio `80000001`; no se guardaron los valores usados para descarte |
| M33 Actualizar unidades | `*-units-*`: General inactivo obligatorio, selección, grupo con varios mensajes, general, rechazo, pending/Escape, descarte y teclado | Dos cambios auditados; BRIF, UEA y General conservados. A sola no ve el botón, tal como está implementado; no se amplió su visibilidad |
| M34 Verificar póliza | `*-policy-*`: cinco errores cliente, general+fuente/fin, resumen a fin, valores conservados, pending, rechazo, guardado, teclado y descarte | Dos pólizas verificadas, VISUAL-D y VISUAL-M |
| M35 Registrar incidente | `*-incident-*`: fecha/descripción, vínculo general o salida, errores conjuntos, resumen, recuperación y guardado | Dos incidentes: general y vinculado. Es formulario de página; Cancelar vuelve al historial, sin inventar modal/descarte |
| M15 Conciliar asistencia | `*-attendance-*`: dos informes contradictorios, decisión/motivo, general, versión real, resumen, pending, teclado y descarte | Resoluciones Participó y No participó; historial conserva ambas. Cada decisión produce las dos auditorías vigentes: servicio y caso de uso |
| M37 Administrar permisos | `*-grant-*`: UUID, rol/unidad, general+campos, resumen, rechazo y concesión ficticia | Dos concesiones de unidad BRIF para UUID ficticios. No se cambiaron roles de los usuarios de prueba. Captura pending desktop incompleta: permanece P en su celda |
| M38 Importar voluntariado | `*-import-*`: archivo mal encabezado, fila inválida con columna/motivo, selección, aceptación, revelado review/apply, archivo conservado, rechazo y aplicación | Solo dos filas válidas, una por viewport; identificaciones únicas. Preview antes/después sin escrituras |
| M39 Importar pólizas | `*-policy-import-*`: persona inexistente excluida, preview, confirmación, general+campos, revelado y recuperación | Dos pólizas pendientes distintas; la importación no las verifica ni inventa vigencia |

Los nombres completos de casos y el estado de **cada celda** están en [la matriz JSON](matriz-visual-consumidores.json). Los archivos del formulario solo aplican a importaciones; Unidades tiene un único grupo, no varios campos independientes. No se fabrican errores de campo para una conexión o permiso.

### Foco, navegación y archivos

- Modales: encabezado inicial, Tab/Shift+Tab, Escape y vuelta al disparador. Dirty conserva el dato al seguir editando y exige descarte explícito en los casos estables registrados. Los errores enfocan campos o resumen y enlazan IDs existentes mediante ARIA.
- Importaciones: el error de selección revela Revisar filas; el de confirmación revela Confirmar aplicación. El archivo permanece seleccionado, observado explícitamente en `mobile-import-file-retained` (`C:\fakepath\volunteers-mobile.csv`), y se reintenta sin cargarlo de nuevo. Los snapshots incluyen el input file aunque la etapa esté oculta.
- Unidades: lista real filtrada por buscar=Persona/unidad=BRIF → ficha → modal → regreso, en ambos tamaños. URL y foco de la fila de origen recuperados (`*-context-restored`). Asistencia mantiene `pestana=herramientas` después del guardado.
- No se atribuye a estos casos un recorrido exhaustivo de Tab por cada campo inline, todos los límites del diálogo nativo, listas largas, Atrás/Adelante o mutaciones que cambien pertenencia. Esas celdas/controles extendidos siguen pendientes, aunque la sección/URL básica esté verificada.

## Defectos reproducidos y correcciones mínimas

| Problema | Evidencia | Corrección y alcance |
| --- | --- | --- |
| CSV previsualizado con LF falla al aplicar desde el navegador | `desktop-import-result-stable` y `desktop-import-real-diagnostic`: conflicto sin cambios reales; el texto original medía 120 bytes y el multipart 123 por CRLF | `lib/registry-import.ts` canonicaliza CRLF a LF antes de parsear/firmar/comparar. No relaja HMAC, versiones, selección, confirmación ni bloqueo. No modifica registros existentes; también normaliza saltos de línea en valores CSV multilinea. Previews antiguos con CRLF pueden requerir previsualizar nuevamente tras una futura publicación |
| Se podía cambiar de etapa durante Aplicando | `desktop-import-pending-section-change` | `SectionWorkspace`: navegación, selector y opciones respetan pending; guardia en select y bloqueo del selector modal. `desktop-import-after-fix-pending`, `mobile-import-pending` y regresión de informe comprueban recuperación |
| Pasar a revisión escondía el selector de archivo enfocado y dejaba BODY | `desktop-import-preview` y `mobile` previo según etapas | `SectionWorkspace` enfoca encabezado/control de la nueva sección solo si el foco es BODY o está en una sección oculta del propio workspace. Omite primer montaje y preserva un foco válido, de error o de otro modal |

No cambiaron estilos, permisos, contratos de operación, reglas de pólizas/asistencia, auditoría, herencia, cupos ni notificaciones.

### Etapas del diff y regresión compartida

A: primeras capturas con fuentes anteriores a estas correcciones (HEAD para `registry-import` y `section-workspace`; los cambios previos de otros componentes permanecen). B: `desktop-import-after-fix-*` prueba canonicalización y pending, antes de incorporar el ajuste de foco entre etapas. C: `desktop-policy-import-*`, casos móviles y regresión de informe incluyen el ajuste de foco. No se presenta B como una nueva medición del foco C; sus errores/archivo permanecen aplicables porque ese ajuste solo interviene con foco perdido u oculto y la regresión C confirma prioridad del campo inválido.

`SectionWorkspace` también se consume en ficha, Administración/importadores, serie automática, creación de serie manual e informe del 70. Se ejercitaron ficha/Administración/importadores reales; además `ReportForm` real en `/coordinacion/auditoria-regresion` **solo dentro de la copia**:

- Guardar borrador incompleto con respuesta demorada: navegación bloqueada en ambos tamaños; error general recupera controles y valores.
- Finalizar inválido: conserva sus seis errores, no acredita asistencia ni muestra éxito.
- Resumen a Acciones y a confirmación final: revela la sección y mantiene el foco del campo, sin ser reemplazado por el nuevo efecto.

No se repitieron las matrices completas de series ni enlaces privados por esta regresión; permanecen en su planificación. La revisión estática confirma que el nuevo comportamiento solo opera con cambio de sección/pending, sin alterar callbacks de guardado. La matriz completa de otros consumidores sigue abierta.

## Evidencia y comprobaciones

- [201 observaciones y AX](../tests/registry-visual/results.json), [eventos de acciones](../tests/registry-visual/server-events.json), [lecturas SQL](../tests/registry-visual/persistence.json), [verificador offline](../tests/registry-visual/verify-results.mjs).
- [Ficha móvil con errores](../tests/registry-visual/evidence/mobile-profile-mixed.png), [preview móvil](../tests/registry-visual/evidence/mobile-import-preview.png), [archivo conservado](../tests/registry-visual/evidence/mobile-import-file-retained.png), [etapa bloqueada desktop](../tests/registry-visual/evidence/desktop-import-after-fix-pending.png), [asistencia móvil](../tests/registry-visual/evidence/mobile-attendance-history.png).
- Antes/después del preview de voluntariado: iguales personas, pólizas, incidentes, resoluciones, concesiones y conteo de auditoría. Para pólizas, se ejecutó la previsualización real y se revisó la misma rutina de solo lectura; no se inventa una pareja de snapshots UI+SQL específica de ese preview. La suite SQL cubre sus filas inválidas, confirmación y reintentos.
- Final: cuatro personas únicas, cuatro pólizas (dos verificadas/dos pendientes), dos incidentes, dos concesiones ficticias nuevas y dos resoluciones; cada uno de los nueve tipos de auditoría aparece dos veces (18 filas). Cola `registration_mail_outbox=0` y `demo_mail=0`.
- `ci:typecheck`, **108 unitarias**, contratos, lint y format:check aprobados con Node 26.13.1. Integración `registry-forms` y `authorization` aprobada en bases desechables distintas: preview, errores múltiples, conflictos/reintento sin duplicados, General obligatorio, políticas y llamadas sin sesión/otra unidad/rol insuficiente. Regresión añadida: firma LF/CRLF equivalente y aplicación con CRLF después de preview LF.
- Build Webpack/HTTP aislado aprobado, incluidos límites server-only, cabeceras/Auth.js y cron no autorizado. Primer intento se bloqueó por EPERM al escuchar; repetición autorizada fuera del sandbox correcta. Sin base de aplicación/proveedores durante el build.
- Verificador offline aprueba 16 combinaciones, asociaciones, retorno, preview sin escrituras y persistencia. **No ejecuta CUA ni convierte la suite en CI autónomo.**

### Observaciones no utilizadas como aprobación

- La primera selección de archivo y creación de pestaña tardaron varios minutos. Un chooser expiró y reinició el REPL; se recuperaron las observaciones ya escritas. No es un fallo de aplicación.
- Algunas acciones inmediatas tras navegación/Hot Reload ocurrieron antes de hidratación o reiniciaron pasos y contadores del adaptador. Se recargó y repitió. Las lecturas transitorias de fechas todavía inválidas durante pending no son el resultado final; se usan mixed/rejection/estables para errores.
- El recolector inicial intentaba iterar FileList y falló en Administración. Se reemplazó por lectura de value. **No hay captura válida pending desktop de permisos**; no se sustituye por móvil ni por un registro servidor.
- `desktop-profile-discard-request`, algunas repeticiones `desktop-units-discard-*` sin aviso y `desktop-import-conflict-repeat` pertenecen a interacciones inmediatas/Hot Reload. Se conservan y no se usan para afirmar fallo o éxito del producto. En página recargada, `desktop-units-fresh-*` reproduce el aviso, descarte y retorno; reabrir ficha recupera el valor Persona.
- Registros de éxito anteriores a corregir CSV no se cuentan como importación aplicada. Rechazar una respuesta en una operación general no prueba por sí solo rollback; en este adaptador los rechazos están explícitamente antes de la llamada real.

## Reproducción y limpieza

Con Node 26.13.1 y el binario local de PostgreSQL indicado en el harness:

```sh
node tests/registry-visual/fixture.mjs
```

El comando crea un clúster nuevo, comprueba su directorio, prepara solo esa base y abre localhost:3044. Imprime el directorio de CSV ficticios. `/audit/start?role=admin`, `?role=general`, `&target=admin` y `&target=attendance` solo existen en la copia. La cookie audit-run reinicia la secuencia de fallos. No debe apuntarse el harness a una URL o base beta.

Durante el fixture, `node tests/registry-visual/snapshot.mjs ETAPA` consulta únicamente el clúster cuyo directorio coincide con active.json. `node tests/registry-visual/checks.mjs sql` ejecuta las dos suites en bases nuevas; `static` y `build` ejecutan las comprobaciones sin dotenv. En futuras ejecuciones, no sobrescribir la evidencia aprobada sin archivarla.

```sh
node tests/registry-visual/verify-results.mjs
```

Al finalizar esta ejecución se detuvo el servidor y se retiraron aplicación, clúster y active.json. CSV/runtime descargado y scripts auxiliares temporales se retiran también. Se conservan harness, capturas y registros ficticios reproducibles, sin fixtures activos en las rutas de la aplicación.

## Pendientes explícitos

- Celdas de contexto extendido, Tab exhaustivo y pending desktop de permisos indicadas en JSON. No cerrar la familia completa a partir de las pruebas compartidas.
- Repetición con **PostgreSQL 18.7**, CI remota, lectores hablados, dispositivos físicos, otros motores, zoom/forced-colors e infraestructura. AX/ARIA y 390×844 no acreditan esos controles.
- No se cambiaron versiones de proveedores ni se publicó. Las correcciones requieren una publicación posterior explícita y sus comprobaciones operativas habituales.
