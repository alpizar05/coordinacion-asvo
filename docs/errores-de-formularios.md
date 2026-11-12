# Errores compartidos de formularios

La primera etapa incorpora la base reutilizable y **Corregir ficha**. La segunda incorpora inscripción pública y gestión privada; la tercera incorpora gestión de inscripciones desde Coordinación y agrupaciones. Los demás formularios mantienen sus implementaciones actuales. No requiere migraciones de base de datos.

## Contrato de servidor

`lib/form-result.ts` define `FormResult<Field>` y `FieldErrors<Field>`:

```ts
return { fieldErrors: { email: 'Ingresá un correo válido.', surname: 'Ingresá el primer apellido.' } };
return { error: 'No tenés permiso para corregir esta ficha.' };
return { saved: true };
```

Cada campo admite un mensaje o una lista de mensajes; los valores vacíos no cuentan como errores. Los errores esperados se devuelven como datos. Una respuesta puede incluir un mensaje general y errores por campo. Solo `saved: true` confirma una operación. Conexión, autorización, registro inexistente y concurrencia permanecen como errores generales. No extraer nombres de campos interpretando cadenas de error.

`editProfile` comprueba permisos de Administración en servidor, valida todos los campos con `validateProfile` antes de escribir y confirma que la persona todavía existe. Actualización y auditoría se mantienen en una transacción. No toca identificación, unidades ni pólizas.

## Componentes y comportamiento

`app/form-feedback/form-feedback.tsx` contiene:

- `useFormFeedback`: estado de errores, identificadores por instancia, primer intento, revalidación localizada y foco.
- `FormFeedbackProvider`: comparte ese estado con los controles y el resumen.
- `FormField`: etiqueta, identificador, `aria-invalid`, asociación del mensaje con `aria-describedby` y `FieldError`. Conserva descripciones previas del control.
- `FieldError`: mensaje persistente de un campo, sin temporizador ni franja de éxito.
- `FormErrorSummary`: todas las correcciones y botones para llegar a cada campo, más el error general si existe.
- `focusFormField`: abre la sección mediante un callback opcional, espera el render y enfoca un control visible y habilitado. Centra el control para evitar que el pie de un modal tape su mensaje. Si no hay un destino disponible, el hook enfoca el resumen.

No se modifica el formulario al validar ni se llama a `reset()` al fallar. No cambiar la `key` del formulario ante un error ni desmontar sus secciones: así se conservan datos, selecciones y archivos. Reiniciar solo al abrir una edición nueva o después del guardado confirmado, según el flujo.

## Integración con ActionModal

El contrato anterior sigue funcionando: `error`, `saved`, `destination`, `successMessage`, apertura local/controlada y validación nativa para formularios no migrados.

Para migrar un formulario, crear un adaptador cliente como `app/coordinacion/registro/profile-editor.tsx`. Recibir únicamente los datos serializables necesarios; importar allí el validador puro y la Server Action. No pasar una función ordinaria desde un Server Component a un Client Component.

```tsx
<ActionModal
  title="Corregir ficha"
  action={editProfile.bind(null, id)}
  validate={validateProfile}
  fieldLabels={profileFieldLabels}
  fieldDependencies={{ medical: ['medical_detail'] }}
  successMessage="Datos de la persona voluntaria actualizados."
>
  <FormField name="email" label="Correo">
    <input name="email" type="email" defaultValue={initial.email} />
  </FormField>
</ActionModal>
```

Al usar `validate`, el modal desactiva las burbujas nativas mediante `noValidate` y reúne los errores en un intento. El mismo validador se ejecuta obligatoriamente en el servidor; el navegador solo anticipa correcciones y nunca autoriza una escritura.

Antes del primer intento no se muestran errores. Después, cambiar un campo revalida únicamente ese campo y las dependencias declaradas; conserva los errores ajenos, incluidos los que solo conoce el servidor. Los errores generales no desaparecen por editar un campo. Las respuestas del servidor sustituyen el conjunto de errores del último intento.

La primera corrección se enfoca en orden de aparición de los controles. Los identificadores se generan con `useId` por instancia, evitando colisiones entre modales montados. Enviar deshabilita los controles y evita un segundo envío; fallar conserva el modal; guardar lo cierra y utiliza la confirmación global existente.

## Formularios por secciones

El hook y `ActionModal` admiten `revealField(name)`:

```tsx
const sectionForField = { email: 'contact', starts: 'dates' };
const feedback = useFormFeedback({
  form,
  validate,
  labels,
  revealField: name => setActive(sectionForField[name] || 'general'),
});
```

El callback debe seleccionar la pestaña/sección que contiene el campo. El helper espera dos cuadros de render antes de enfocar. Nunca abre secciones manipulando `hidden` directamente: respeta el estado del editor. Para radios o grupos, proveer un control enfocable apropiado y una asociación accesible de sus mensajes. Los editores y el informe del 70 todavía conservan sus implementaciones actuales; su migración corresponde a etapas posteriores.

## Validación de ficha

`lib/profile-validation.ts` es puro y compartido entre servidor y navegador. Reúne nombre, primer apellido, formato de correo, fecha real de nacimiento, años de cuatro dígitos, opciones booleanas y detalle médico obligatorio cuando se indica una condición. El formulario conserva los campos opcionales y no añade obligatoriedad a datos que antes eran opcionales.

## Verificación de esta etapa

- `node scripts/test-form-feedback.mjs`: errores simultáneos, fechas válidas/inválidas, condición médica, opciones no admitidas y actualización de un error sin borrar otros ni mutar los datos.
- `npm run check` y `npm run build -- --webpack`: correctos.
- Navegador local, ficha ficticia: cero errores antes del primer intento; nombre vacío, correo inválido y año inválido producen tres mensajes y foco en Nombre. Corregir Nombre conserva los otros dos. El resumen enfoca el año seleccionado. Se comprobaron asociaciones accesibles y ausencia de identificadores duplicados.
- En celular a 390 px: resumen legible, controles conservados y foco centrado para dejar visible el mensaje. Corregir correo y año permite guardar, cierra el modal y conserva el mecanismo de confirmación existente. No se enviaron correos reales ni se modificó la beta.

Pendiente en siguientes etapas: migrar los formularios restantes y verificar sus reglas, permisos, fotos y secciones específicas. La prueba visual de esta etapa no cubre aún esos flujos.

## Segunda etapa: inscripción pública y gestión mediante enlace privado

Se migraron los tres formularios: inscripción pública, edición privada y cancelación privada. Las acciones devuelven resultados estructurados ante errores, conservando los controles montados. No redirigen al fallar ni reinician datos. La inscripción correcta mantiene el recibo mediante cookie HttpOnly y navega a la misma PDP, donde aparece el modal de recepción con el nombre de la persona.

`lib/registration-validation.ts` reúne identificación de nueve dígitos, fechas flexibles válidas con al menos un día de intersección, cantidades enteras de transporte entre 0 y 100, límites de textos, motivo y aceptación cuando corresponda. El máximo de transporte coincide con los formularios de Coordinación. Las fechas fijas se resuelven en servidor desde la convocatoria; los campos de fecha permiten extender la participación flexible para posterior aprobación de Coordinación. Los mensajes de identificación no encontrada y póliza no vigente permanecen separados de los errores de formato y usan el modal de aviso, que al cerrarse vuelve al formulario preservado.

`lib/public-registration.ts` ejecuta las comprobaciones y mutaciones en una transacción. Mantiene el bloqueo de la convocatoria, validación de invitación, póliza, unidad, cupos y promoción de espera existentes. Una inscripción activa repetida no crea otra fila ni otra notificación. Una edición repetida sin cambios y una cancelación ya aplicada se reconocen sin volver a notificar ni promover. No altera la confirmación de cupo; cambiar fechas de una inscripción confirmada la devuelve a revisión conservando su reserva.

`register` y `submitPrivateRegistration` son los adaptadores de servidor. `privateAction` mantiene compatibilidad con el flujo anterior y las pruebas existentes; los formularios nuevos usan `submitPrivateRegistration`, que no redirige ante errores. Los errores de permisos, cambio de calendario, vencimiento de enlace y conexión se presentan como generales. Si el servidor exige una aceptación que el cliente todavía no mostraba, se habilita ese campo antes de enfocarlo.

«Recordar mis datos» conserva los únicos valores autorizados: identificación, transporte, cantidad de personas y restricciones alimentarias. La preferencia mantiene su duración de 90 días y se consolida únicamente tras una inscripción recibida; se vuelve a procesar para cada recibo. Desmarcar elimina lo almacenado sin limpiar el formulario. No se agregaron tokens, motivo de cancelación ni observaciones a localStorage. No se usa almacenamiento persistente para conservar errores o formularios privados.

Comprobaciones de esta etapa:

- `node --env-file=.env.local scripts/test-public-registration.mjs`: requiere explícitamente ASVO_DEMO y PostgreSQL local. Usa una transacción revertida y bloquea fetch real. Cubre errores simultáneos, formato, fechas flexibles, identificación inexistente, póliza, unidad, cupos/espera, edición confirmada que vuelve a revisión, motivo y aceptación en servidor, promoción y reintentos sin duplicar notificaciones.
- `node --env-file=.env.local scripts/test-registration-workflow.mjs`: regresión del flujo existente correcta. Se ajustó únicamente el destinatario de la prueba de Graph simulado a `example.invalid`: el destinatario `.test` anterior era descartado correctamente por la protección y no permitía probar el reintento. Las llamadas siguen simuladas.
- `node scripts/test-mail-test-recipients.mjs`: confirma que `.test` no autentica ni envía por Graph.
- Navegador local: tres errores públicos simultáneos, pegado `990-000-090` convertido en nueve dígitos, mensajes distintos de identificación y póliza, valores conservados al cerrar avisos, modal correcto con nombre y permanencia en PDP. Desmarcar recordar conserva los campos visibles.
- Gestión privada: errores independientes de fechas/transporte y motivo/aceptación en los dos formularios, edición válida que conserva cupo y vuelve a revisión, cancelación válida y promoción de la persona en espera. Diseño revisado en desktop y 390 px.
- Conteos de la prueba visual: una inscripción pública recibida, una privada cancelada y una persona promovida a revisión; cero registros de correo real. Los datos temporales de prueba se retiraron de la base local. La beta no se modificó.

No requiere cambio de esquema. Los formularios restantes de Coordinación, fotografías, series e informe del 70 continúan pendientes para las siguientes etapas.

## Tercera etapa: inscripciones desde Coordinación y agrupaciones

Se incorporaron Agregar persona, Editar inscripción, confirmar, pasar a espera, rechazar, cancelar, recuperar inscripción anterior y crear salida desde una agrupación. Reutilizan `FormResult`, `FormField`, `FormErrorSummary` y `useFormFeedback`; la agrupación usa el contrato ampliado de `ActionModal`.

`lib/staff-registration-validation.ts` reúne las reglas puras de participación, persona seleccionada, identificación histórica, motivo, aprobación de fechas, título y cupo. Las reglas independientes se reúnen antes de escribir. La recuperación conserva el formato histórico admitido por Coordinación; el requisito de nueve dígitos de inscripción pública no se impone retroactivamente a los identificadores históricos. Los campos de transporte permanecen montados al ocultarse para conservar sus valores.

`manageStaffEntry` bloquea primero la salida y después la inscripción, autoriza la unidad y compara una huella del registro y el calendario capturados al abrir la acción. Un cambio concurrente, traslado, permiso insuficiente o transición de negocio inválida es un error general. No actualiza silenciosamente la versión de un panel ya abierto. `splitStaffGroup` vuelve a comprobar los integrantes bajo bloqueo: una agrupación modificada es un conflicto general; título y cupo inválidos se presentan junto a sus campos. Se conserva la transacción de clonación, traslado, auditoría, notificaciones y promoción de espera.

Los errores no cierran ni desmontan el formulario o acción seleccionada. Gestionar mantiene el menú compacto de desktop y panel inferior móvil. Las decisiones y ediciones exitosas refrescan la ruta actual conservando sus parámetros, pestaña y posición; la agrupación conserva los parámetros de la vista y evita desplazamiento automático. Solo `saved: true` activa la confirmación global. Enviar se protege con una referencia síncrona además de deshabilitar controles. Un reintento con versión anterior no repite la decisión; una edición idéntica no repite auditoría ni notificación.

Comprobaciones:

- `node --env-file=.env.local scripts/test-staff-form-errors.mjs`: exige ASVO_DEMO y host local, bloquea red real y revierte la prueba principal. Comprueba errores simultáneos, permisos generales, aprobación, motivos, estados, identificación inexistente, recuperación con cupo disponible, versiones obsoletas, agrupación modificada y creación válida. Una segunda prueba lanza dos decisiones concurrentes con la misma versión: un guardado, un conflicto, una auditoría y una notificación demo; elimina sus datos temporales al terminar.
- Regresiones `test-registration-workflow.mjs`, `test-public-registration.mjs` y `test-form-feedback.mjs` correctas; recepción concurrente, cupos, espera, ediciones y cancelaciones conservan sus reglas.
- `npm run check` y `npm run build` correctos.
- Navegador local desktop: Agregar persona reúne persona faltante y transporte inválido, enfoca la búsqueda y conserva las restricciones ingresadas. Corregir transporte retira solo ese error. Gestionar conserva la acción de espera abierta y enfoca el motivo vacío.
- Navegador a 390 px: se mantiene el panel inferior con la misma acción y error. Editar inscripción presenta simultáneamente llegada y regreso inválidos, enfoca la primera fecha y conserva observaciones. Las pruebas visuales se cerraron sin guardar cambios en las fichas demo existentes.

No se enviaron correos reales ni se modificó la beta. No hay migraciones de esquema. Los formularios de otras áreas continúan pendientes.


## Cuarta etapa: registro, asistencia y Administración

Se migraron Verificar póliza, Actualizar unidades, Registrar incidente, Conciliar asistencia, Administrar permisos e importar voluntariado/pólizas. Corregir ficha conserva el patrón de la primera etapa. `lib/registry-validation.ts` reúne las validaciones puras y `RegistryModal`/`RegistryForm` reutilizan el contrato y los componentes compartidos. `FormFieldGroup` asocia errores al grupo de unidades o filas mediante `aria-invalid` y `aria-describedby`.

Las comprobaciones de autorización siguen en las acciones del servidor: Administración corrige fichas, verifica pólizas e importa/administra accesos; Coordinación conserva sus atribuciones para unidades, incidentes y asistencia. No se amplían permisos operativos. Voluntariado General se incluye siempre al actualizar unidades y permanece protegido por la restricción existente de base de datos. Los errores de permisos, evidencia modificada, vínculos desaparecidos y conflictos de importación son generales. Ya no hay retornos silenciosos en estas acciones.

`lib/registry-mutations.ts` conserva auditoría y transacciones. Bloquea la persona para evitar duplicar una póliza idéntica verificada o un incidente idéntico (misma persona, salida, fecha, descripción y coordinador). Las asignaciones de permiso repetidas no duplican auditorías; la revocación del propio rol de administrador es un error general. Conciliar la misma decisión y motivo sobre evidencia vigente no crea otra resolución. Una evidencia modificada exige volver a revisar los informes.

### Importaciones

`lib/registry-import.ts` separa previsualización y aplicación. La primera analiza y consulta sin escribir. Devuelve número físico de fila, columna y motivo; las filas incompletas, duplicadas o sin persona asociada quedan deshabilitadas. Encabezados, tamaño, lectura y formato de archivo se presentan junto al selector CSV. Las reglas de identificadores históricos se mantienen, sin imponer el formato de inscripción pública a registros anteriores.

Aplicar requiere filas válidas seleccionadas, casilla explícita de confirmación y una firma HMAC de la previsualización (archivo y estado observado). Usa el `AUTH_SECRET` existente; solo el modo demo local admite una firma de prueba. El servidor vuelve a analizar y validar todas las filas seleccionadas; una selección manipulada que incluye filas inválidas no aplica ninguna. Compara el estado observado, bloquea los registros afectados y aplica en una transacción. Si alguien modificó la ficha entre revisar y aplicar, devuelve un conflicto general. El botón Actualizar previsualización permite revisar el mismo archivo conservado, mantiene las selecciones todavía válidas y exige confirmar nuevamente.

Un reintento de voluntariado ya aplicado se reconoce únicamente con la firma auténtica y los valores seleccionados ya idénticos. La identificación única impide duplicar personas; pólizas pendientes conservan el índice único existente. Las filas idénticas no generan nuevas auditorías. Ninguna importación envía correos o notificaciones.

### Secciones y conservación

El helper de foco emite `asvo:reveal-form`; cada `SectionWorkspace` contenedor selecciona su sección mediante estado React antes del foco. El asistente de importación abre además Cargar, Revisar o Confirmar según el campo. No desmonta las etapas al fallar: conserva archivo, datos y selección. Los mensajes generales también revelan el formulario que los contiene. `FormField` resuelve los hijos transmitidos desde Server Components mediante `Children.toArray` antes de asociar sus atributos accesibles.

### Verificación

- `node --env-file=.env.local scripts/test-registry-form-errors.mjs`: exige PostgreSQL demo local, bloquea red real y revierte todos los cambios. Cubre errores simultáneos de póliza/incidente/asistencia, validación de ficha, unidad obligatoria, permisos ficticios, evidencia obsoleta, errores CSV por fila/columna, archivos malformados y grandes, preview sin escrituras, confirmación obligatoria, selección inválida sin aplicación, cambios concurrentes, altas nuevas y reintentos sin duplicados ni auditorías repetidas.
- Navegador local: permiso con identificador vacío enfoca ese campo; CSV con encabezados inválidos enfoca el selector; fila con nombre/correo inválidos muestra ambas columnas y permanece deshabilitada. Una fila válida exige confirmación explícita. El enlace del resumen abre la etapa de Confirmar y enfoca su casilla. Se revisó la presentación a 390 px.
- Navegador local: Verificar póliza reúne cinco errores y enfoca Tipo; Corregir ficha reúne Nombre y Correo y conserva los demás datos. Se cerraron sin guardar las fichas ficticias existentes. No se aplicaron importaciones ni cambios de permisos desde la prueba visual.
- Tipos, build y pruebas de regresión de formularios, inscripciones, cupos, concurrencia y destinatarios `.test` correctos. No hay migraciones de esquema ni cambios en beta, permisos reales o correos reales.

## Quinta etapa: convocatorias, series, fotografías e informe del 70

Los editores de nueva convocatoria/nuevo bloque, convocatoria individual/bloque, datos comunes, creación de serie manual, fotos, informe e invitaciones/enlaces del 70 usan `FormResult`, el resumen compartido y el mismo helper de foco. Se retiraron los estados de error único de estos editores. `lib/outing-form-validation.ts` reúne las reglas puras y `lib/outing-report-validation.ts` separa la validación del informe de sus consultas/transacciones.

### Adaptación de editores largos

`FormFeedbackBindings` adapta los controles existentes sin recrearlos ni cambiar su estado. Asocia los errores con `aria-invalid`/`aria-describedby` y utiliza `FieldError` mediante portales junto al control. Respeta los componentes que ya usan `FormField`. Las claves `data-feedback-fields` permiten enfocar un grupo, el botón de una foto preparada o un campo heredado que primero debe personalizarse. Los mensajes conservan identificadores únicos por formulario y las etiquetas del resumen se obtienen de las etiquetas accesibles existentes.

Los periodos conservan identificadores estables aunque se quite uno intermedio. El servidor devuelve campos como `period-7-starts`, con número visible del periodo en el mensaje. Las fotos preparadas también conservan su identidad; el adaptador de nueva convocatoria transforma índices de envío a los identificadores de la interfaz. Cada archivo puede tener errores independientes de imagen, descripción, crédito o autorización. Los errores del servicio de almacenamiento y de acceso a una foto que ya no está disponible permanecen generales.

El validador del navegador anticipa correcciones; el servidor repite la validación y comprueba permisos, capacidad ocupada, herencia y versiones antes de escribir. Los cambios de fechas/unidad incompatibles con inscripciones son conflictos generales. Una convocatoria individual mantiene edición directa; únicamente los bloques de una serie habilitan personalización/herencia. Los datos de solicitud compartida se validan cuando cambian y se conserva su confirmación para todos los bloques. La edición de datos comunes exige seleccionar explícitamente los campos y confirmar el alcance; además compara una huella de solicitud, bloques y metadatos de fotos para detectar cambios concurrentes.

### Fotografías

`PhotoDialog` usa los componentes compartidos y conserva archivo, descripción, crédito y autorización ante errores. La selección de galería y la carga tienen errores específicos. El formulario se presenta en un portal independiente: evita anidar formularios y su envío no se propaga al editor de convocatoria. Verifica tipo, tamaño, lectura de imagen y megapíxeles antes de invocar el guardado. El servidor repite las comprobaciones aplicables, incluida la autorización de las nuevas fotos del editor. Las fotos inválidas se preparan y reportan antes de cargar originales; un error general de SharePoint permite reintentar con los archivos todavía preparados.

### Informe

Labores, gira, asistencia y confirmación usan `FormField` o `FormFieldGroup`; sus mensajes están asociados y el resumen abre la sección antes de enfocar. La validación compartida distingue el último intento de Guardar borrador/Finalizar. Un borrador admite campos finales incompletos y no acredita asistencia. Finalizar exige los datos definitivos, participantes y confirmación. Los conflictos de lista, acceso, versión de borrador y el bloqueo de un informe finalizado se presentan como generales. El contrato legado de errores del dominio se mantiene para compatibilidad; el adaptador del formulario expone la clasificación compartida.

Invitaciones y enlaces del 70 reutilizan `PrivateLinkForm`: errores junto a identificación/persona seleccionada, datos conservados y éxito únicamente después de recibir el enlace generado. Los enlaces no se guardan en localStorage.

### Comprobaciones

- `scripts/test-outing-form-errors.mjs`: requiere PostgreSQL demo local, bloquea `fetch` real y revierte su transacción. Comprueba errores conjuntos de varios periodos, archivos/metadatos/autorización, alcance de serie, edición individual sin personalización, herencia de bloques, versión obsoleta, borrador incompleto sin evidencia de asistencia y finalización bloqueada. El callback de carga no se ejecuta durante las entradas inválidas.
- Navegador: Nueva convocatoria reúne errores de título, lugar, periodos, cupo y portada; el resumen abre las secciones. Serie manual reúne nombre y selección. Datos comunes exige alcance y confirmación sin modificar filas.
- Navegador: el modal de fotos reúne archivo/descripción/autorización. Un archivo ficticio dañado muestra el error junto al selector y conserva archivo, descripción, crédito y casilla; no se carga a SharePoint.
- Navegador: un informe ficticio guardó borrador con acciones, responsable y asistencia finales pendientes. Después de completar los campos y confirmar participación, finalizó y mostró la vista definitiva sin controles de edición. La prueba temporal fue retirada de PostgreSQL local.
- Tipos, compilación y regresiones de ficha, registro, importaciones, gestión de inscripciones, concurrencia, cupos, gestión privada y correos `.test` correctas. No se hicieron cargas ni correos reales, ni cambios en la beta. No se requiere migración de esquema.


## Revisión integral y cierre del alcance activo

Ver el [inventario, correcciones, evidencia y limitaciones](auditoria-errores-formularios.md). La revisión añadió errores por campo a las decisiones finales de salida y los filtros de fechas; corrigió el orden de foco de grupos/aliases, bordes visuales, despliegues nativos y conservación de acciones al cambiar de sección. Los errores de filtros pueden presentarse sin robar el foco al cargar una URL (`showErrors(errors, mensaje, false)`); su resumen usa `purpose="aplicar los filtros"`. Los fallos generales y las operaciones sin campos permanecen generales.
