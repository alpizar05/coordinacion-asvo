# Mejoras pendientes de la plataforma

Recomendaciones de la evaluación del 10 de noviembre de 2026. Las casillas indican cuáles recomendaciones están implementadas y verificadas. Los pendientes de infraestructura y lanzamiento se mantienen en el [manual de despliegue](docs/despliegue-y-configuracion.md#12-checklist-de-beta-y-lanzamiento).

## Orden sugerido para comenzar

1. Búsqueda, filtros y paginación de Voluntariado.
2. Filtros activos visibles en las listas móviles.
3. Historial de cada inscripción.

## Prioridad alta

- [x] **Agregar una persona voluntaria a una salida desde Coordinación.** Botón «Agregar persona» en Inscripciones, con modal de búsqueda por nombre, identificación o correo y detalles de fechas, transporte, alimentación, interés en ser 70 y observaciones. Verifica permisos, unidad, póliza, fechas y duplicados; asigna revisión o espera según cupos, respeta la cola, registra al coordinador y notifica por correo. Verificado con pruebas de integración y revisión del modal en desktop y celular.

- [x] **Buscar personas voluntarias y paginar el registro.** Buscar por nombre, identificación o correo; filtrar por unidad; paginar desde el servidor para evitar cargar todo el registro. Conservar los criterios al cambiar de página. Implementado con 25 registros por página, búsqueda sin distinción de tildes o mayúsculas, filtros móviles en modal y pruebas de integración locales.
- [x] **Mostrar pendientes de Coordinación.** Resumen es la entrada principal: pestañas con conteos de revisión, salidas próximas sin 70 e informes pendientes por cada 70 asignado. Incluye gestión directa, filtros por unidad, periodos de 7/14/30 días, preferencias por usuario y próximas salidas con logística. Se excluyen canceladas y se respetan los permisos por unidad.
- [ ] **Mostrar filtros activos en celular.** Debajo del contador, presentar etiquetas removibles con los criterios aplicados y una opción para restablecer los filtros de la vista. Mantener el modal de filtros y actualizar etiquetas, resultados y contador conjuntamente.
- [x] **Presentar el historial de cada inscripción.** Mostrar recepción, confirmación, cancelación, reactivación y notificaciones, con fecha, responsable y motivo cuando corresponda. Distinguir correos pendientes de mensajes enviados, usando auditoría y cola existentes donde sea posible.

## Prioridad media

- [ ] **Buscar y filtrar convocatorias públicas.** Agregar búsqueda por lugar y filtros por fechas, unidad y modalidad flexible en «Más convocatorias». Definir cómo se aplican a las series y sus bloques, sin perder el orden por próxima fecha.
- [ ] **Estructurar la logística de las salidas.** Implementados campos por bloque de transporte, alimentación y hospedaje, con copia y visualización en logística, portal público y resumen del 70. Pendiente completar campos específicos de encuentro y equipo. Incorporar campos de encuentro, transporte, hospedaje, alimentación y equipo. Identificar información pendiente y reutilizar los datos en el resumen para el 70, conservando los textos existentes durante la transición.
- [ ] **Consultar y gestionar las notificaciones de correo.** Mostrar estado enviado/pendiente y último intento, con reintento manual autorizado. Reutilizar la cola y sus controles de concurrencia y orden; no duplicar mensajes ya enviados.
- [ ] **Facilitar el cierre de salida.** Reunir informe del 70, asistencia real e incidentes antes de completar la salida. Mostrar qué información está registrada y definir cuáles pendientes bloquean el cierre y cuáles solo generan una advertencia.

## Consistencia de interacción

- [ ] **Confirmar las operaciones guardadas.** Mostrar una franja temporal con un mensaje específico al guardar en modales, por ejemplo «Unidades actualizadas» o «Póliza registrada».
- [ ] **Señalar errores por campo.** Asociar los errores administrativos al campo correspondiente, llevar el foco a la primera corrección necesaria y conservar los datos para reintentar.
- [ ] **Conservar el contexto al regresar a una lista.** Recuperar filtros, página y posición de desplazamiento después de consultar una persona, convocatoria o inscripción.

## Historiales y trayectoria del voluntariado

Orden propuesto: historial de inscripción y participaciones de la persona voluntaria primero; después historial de convocatoria y cambios de ficha.

- [x] **Ampliar el historial de cada inscripción.** Integrarlo en Gestionar → Ver inscripción como línea de tiempo con fecha, responsable, motivo y detalle de qué cambió (fechas y datos logísticos). Incluir recepción, cupo, lista de espera, confirmación, cancelación y reactivación. Mostrar los correos vinculados con estado pendiente/enviado/cancelado, distinguiendo la acción del resultado de su notificación. Complementa la tarea de prioridad alta ya registrada.
- [x] **Mostrar la trayectoria de cada persona voluntaria.** Agregar Participaciones a su ficha, con tabla en desktop y lista compacta en celular: salida, fechas, resultado y responsabilidad como integrante o 70. Incluir resumen de salidas con participación real confirmada, veces como 70, última participación e informes pendientes a su cargo. Permitir consultar la salida e inscripción asociadas según permisos.
- [ ] **Definir y conciliar la evidencia de asistencia.** Implementada la detección de discrepancias y su exclusión de los totales; pendiente el flujo de resolución manual con auditoría. Distinguir inscripción recibida, cupo confirmado, cancelación y participación real. Usar únicamente informes finalizados del 70 para acreditar asistencia; un borrador no completa la tarea ni confirma participación. Si varios informes discrepan para la misma persona y salida, mostrar «Asistencia por conciliar» y permitir resolverla a Coordinación con auditoría. Evitar duplicar participaciones cuando varios 70 informen sobre la misma salida.
- [ ] **Agregar historial de cada convocatoria.** En Herramientas → Historial de la salida, registrar creación, cambios relevantes de fechas, cupos, visibilidad, fecha límite, logística, asignaciones de 70, separación de grupos y cierre. Enlazar los historiales de inscripción sin repetir todos sus eventos individuales.
- [ ] **Mostrar historial de cambios de la ficha de voluntariado.** Registrar correcciones de identidad/contacto, pertenencia a unidades y pólizas, indicando responsable, fecha y cambios. Respetar las atribuciones de Administración y Coordinación y evitar exponer datos fuera del alcance del rol.
- [ ] **Conectar los historiales existentes de incidentes y comunicaciones.** Mantener incidentes como sección separada con su contexto y permisos; vincular correos y recordatorios a la inscripción o informe correspondiente. Reutilizar auditoría y cola existentes antes de crear registros duplicados.
- [ ] **Definir métricas de días y horas de voluntariado antes de incorporarlas.** Establecer cómo registrar fechas reales individuales y duración efectiva. No calcular horas ni días acumulados a partir de una inscripción o del periodo general sin evidencia suficiente.

Criterios para todos los historiales: reutilizar evidencia existente, ampliar la auditoría para cambios nuevos y señalar información histórica no disponible. No inventar fechas, responsables ni participaciones. Mostrar únicamente lo autorizado por el rol y la unidad.

## Criterios comunes de implementación

- Mantener la tabla en desktop y las listas compactas en celular.
- Respetar roles y unidades tanto en consultas como en acciones de servidor.
- Verificar estados vacíos, filtros sin resultados, nombres largos y uso con teclado.
- Marcar cada tarea como completada únicamente después de implementarla y verificarla.

## Seguimiento implementado

- [x] Recordatorios manuales de informes desde Resumen: seguimiento por 70, enlace vigente, vista previa, auditoría y cola con bloqueo de duplicados pendientes. Los reintentos descartan recordatorios que ya no corresponden. Recordatorios automáticos quedan por definir cuando exista un plazo para presentar informes.
