# Mejoras pendientes de la plataforma

Recomendaciones de la evaluación del 10 de noviembre de 2026. Las casillas indican cuáles recomendaciones están implementadas y verificadas. Los pendientes de infraestructura y lanzamiento se mantienen en el [manual de despliegue](docs/despliegue-y-configuracion.md#12-checklist-de-beta-y-lanzamiento).

## Orden sugerido para comenzar

1. Historial de cada convocatoria.
2. Historial de cambios de la ficha de voluntariado.

## Prioridad alta

- [x] **Agregar una persona voluntaria a una salida desde Coordinación.** Botón «Agregar persona» en Inscripciones, con modal de búsqueda por nombre, identificación o correo y detalles de fechas, transporte, alimentación, interés en ser 70 y observaciones. Verifica permisos, unidad, póliza, fechas y duplicados; asigna revisión o espera según cupos, respeta la cola, registra al coordinador y notifica por correo. Verificado con pruebas de integración y revisión del modal en desktop y celular.

- [x] **Buscar personas voluntarias y paginar el registro.** Buscar por nombre, identificación o correo; filtrar por unidad; paginar desde el servidor para evitar cargar todo el registro. Conservar los criterios al cambiar de página. Implementado con 25 registros por página, búsqueda sin distinción de tildes o mayúsculas, filtros móviles en modal y pruebas de integración locales.
- [x] **Mostrar pendientes de Coordinación.** Resumen es la entrada principal: pestañas con conteos de revisión, salidas próximas sin 70 e informes pendientes por cada 70 asignado. Incluye gestión directa, filtros por unidad, periodos de 7/14/30 días, preferencias por usuario y próximas salidas con logística. Se excluyen canceladas y se respetan los permisos por unidad.
- [x] **Mostrar filtros activos en celular.** Etiquetas sutiles removibles en Solicitudes de inscripción, Convocatorias de salida, Convocatorias en serie, Voluntariado, Resumen, inscripciones de una salida y selección de salidas para una serie. Mantienen los demás criterios y sincronizan el modal. Restablecer recupera los valores iniciales de cada vista; en Registro maestro se conserva la acción del encabezado. Verificado con TypeScript y navegación móvil local.
- [x] **Presentar el historial de cada inscripción.** Mostrar recepción, confirmación, cancelación, reactivación y notificaciones, con fecha, responsable y motivo cuando corresponda. Distinguir correos pendientes de mensajes enviados, usando auditoría y cola existentes donde sea posible.

## Prioridad media

- [ ] **Buscar y filtrar convocatorias públicas.** Agregar búsqueda por lugar y filtros por fechas, unidad y modalidad flexible en «Más convocatorias». Definir cómo se aplican a las series y sus bloques, sin perder el orden por próxima fecha.
- [ ] **Estructurar la logística de las salidas.** Implementados campos por bloque de transporte, alimentación y hospedaje, con copia y visualización en logística, portal público y resumen del 70. Pendiente completar campos específicos de encuentro y equipo. Incorporar campos de encuentro, transporte, hospedaje, alimentación y equipo. Identificar información pendiente y reutilizar los datos en el resumen para el 70, conservando los textos existentes durante la transición.
- [ ] **Consultar y gestionar las notificaciones de correo.** Mostrar estado enviado/pendiente y último intento, con reintento manual autorizado. Reutilizar la cola y sus controles de concurrencia y orden; no duplicar mensajes ya enviados.
- [ ] **Facilitar el cierre de salida.** Reunir informe del 70, asistencia real e incidentes antes de completar la salida. Mostrar qué información está registrada y definir cuáles pendientes bloquean el cierre y cuáles solo generan una advertencia.

## Portal público de convocatorias

- [ ] **Agregar búsqueda y filtros en «Más convocatorias».** Desarrollar la tarea de búsqueda pública ya registrada: nombre o lugar, rango de fechas de participación, unidad y modalidad flexible o posibilidad de apoyar un solo día. En celular, usar modal y etiquetas sutiles removibles; mostrar contador de resultados y un estado sin coincidencias con opción de restablecer. Conservar el orden por próxima fecha y definir el comportamiento de series y bloques.
- [ ] **Adaptar la portada cuando hay pocas convocatorias.** Si solo hay una salida vigente, mostrarla como destacada sin repetirla en «Más convocatorias». Con varias, mantener el catálogo completo de salidas individuales y series según las reglas vigentes.
- [ ] **Facilitar la comparación de fechas en las tarjetas.** Evaluar fechas compactas como «27–29 nov. 2026», días de la semana y duración. En series, indicar próxima salida y cantidad de fechas disponibles. Mantener legibilidad con 3, 4 o 5 tarjetas por fila.
- [ ] **Explicar cómo participar.** Agregar una indicación discreta sobre registro de voluntariado y póliza vigente, con acceso a una explicación breve y orientación para quienes aún no están registrados. Definir el contacto o enlace real antes de publicarlo.
- [ ] **Afinar la salida destacada.** Usar «Ver convocatoria» para una salida y «Ver fechas disponibles» para una serie; sustituir «Cupos por fecha» por la cantidad de fechas disponibles. Mostrar el cierre de inscripción cuando esté próximo y mantener una altura contenida en celular.
- [ ] **Agregar una acción discreta al hero editorial.** Incorporar «Explorar convocatorias ↓» para llevar al catálogo, conservando fotografía, tipografía y degradado actuales.
- [ ] **Definir y ampliar el menú del portal de voluntariado.** Evaluar las opciones «Convocatorias», «Salidas de un solo día», «Cómo participar», «Recursos para la persona voluntaria», «Herramientas» y «Contacto con Coordinación». Mantener el menú lateral en celular y separar claramente las opciones públicas de las de Coordinación para usuarios autorizados. Definir el contenido de cada destino antes de habilitarlo; evitar enlaces vacíos o secciones redundantes.
- [ ] **Ofrecer acceso a salidas de un solo día.** Desde el menú, abrir el catálogo con un criterio de participación de un día. Distinguir salidas que duran un día de bloques flexibles que permiten apoyar un solo día; basarse en la configuración explícita de cada convocatoria y conservar los filtros al navegar.
- [ ] **Preparar recursos y herramientas para la persona voluntaria.** Evaluar guías de preparación, equipo recomendado, póliza, transporte, preguntas frecuentes, documentos y contactos institucionales. Separar recursos informativos de herramientas para realizar acciones concretas; definir estas últimas y sus permisos antes de implementarlas, sin exponer datos personales ni asumir que existe una cuenta de voluntariado.

## PWA y notificaciones de Coordinación

- [ ] **Habilitar ASVO Coordinación como PWA instalable.** Agregar manifiesto, iconos y service worker, con entrada en Resumen y acceso mediante Microsoft Entra ID. Incluir instrucciones de instalación para Android y iPhone; en iPhone, push requiere iOS 16.4 o posterior y la aplicación agregada a la pantalla de inicio. Mantener las consultas y operaciones con conexión, sin almacenar fichas personales para uso sin conexión en esta primera versión.
- [ ] **Enviar notificaciones push a Coordinación.** Primera etapa: activación voluntaria por dispositivo, preferencias por tipo de aviso y notificaciones de nuevas inscripciones y cancelaciones realizadas por voluntariado. Respetar roles y unidades al seleccionar destinatarios; al tocar el aviso, abrir el registro correspondiente y exigir sesión vigente. Evitar datos personales sensibles en el contenido visible en la pantalla bloqueada.
- [ ] **Incorporar una bandeja de notificaciones y un resumen diario.** Guardar los avisos en PostgreSQL, agrupar nuevas inscripciones para evitar saturación y conservar correo y «Requiere atención» como respaldo. Implementar deduplicación, reintentos y eliminación de suscripciones vencidas. Considerar el límite de ejecución diaria por cron en Vercel Hobby al programar el resumen y los reintentos; los avisos por eventos se intentan al ocurrir la acción.
- [ ] **Ampliar los avisos según prioridad y preferencias.** Evaluar salidas próximas sin 70, informes pendientes o finalizados y asistencia por conciliar. Definir anticipación, frecuencia y cuándo deja de corresponder cada aviso antes de automatizarlo.
- [ ] **Verificar instalación y entrega push durante la beta.** Probar permisos aceptados/denegados, varios dispositivos, cierre de sesión, cambios de rol y apertura de enlaces. La entrega push no garantiza lectura; mantener los pendientes disponibles dentro del portal. Al migrar a `voluntariado.asvocr.org`, prever nueva instalación o activación de notificaciones en ese dominio.

## Consistencia de interacción

- [ ] **Confirmar las operaciones guardadas.** Mostrar una franja temporal con un mensaje específico al guardar en modales, por ejemplo «Unidades actualizadas» o «Póliza registrada».
- [ ] **Señalar errores por campo.** Asociar los errores administrativos al campo correspondiente, llevar el foco a la primera corrección necesaria y conservar los datos para reintentar.
- [ ] **Conservar el contexto al regresar a una lista.** Recuperar filtros, página y posición de desplazamiento después de consultar una persona, convocatoria o inscripción.

## Historiales y trayectoria del voluntariado

Orden propuesto: historial de inscripción y participaciones de la persona voluntaria primero; después historial de convocatoria y cambios de ficha.

- [x] **Ampliar el historial de cada inscripción.** Integrarlo en Gestionar → Ver inscripción como línea de tiempo con fecha, responsable, motivo y detalle de qué cambió (fechas y datos logísticos). Incluir recepción, cupo, lista de espera, confirmación, cancelación y reactivación. Mostrar los correos vinculados con estado pendiente/enviado/cancelado, distinguiendo la acción del resultado de su notificación. Complementa la tarea de prioridad alta ya registrada.
- [x] **Mostrar la trayectoria de cada persona voluntaria.** Agregar Participaciones a su ficha, con tabla en desktop y lista compacta en celular: salida, fechas, resultado y responsabilidad como integrante o 70. Incluir resumen de salidas con participación real confirmada, veces como 70, última participación e informes pendientes a su cargo. Permitir consultar la salida e inscripción asociadas según permisos.
- [x] **Definir y conciliar la evidencia de asistencia.** Implementada la revisión en Herramientas → Asistencia, con decisiones Participó/No participó/Mantener pendiente, motivo obligatorio y versiones auditadas. Un informe nuevo contrario invalida la resolución; uno concordante la conserva. Distinguir inscripción recibida, cupo confirmado, cancelación y participación real. Usar únicamente informes finalizados del 70 para acreditar asistencia; un borrador no completa la tarea ni confirma participación. Si varios informes discrepan para la misma persona y salida, mostrar «Asistencia por conciliar» y permitir resolverla a Coordinación con auditoría. Evitar duplicar participaciones cuando varios 70 informen sobre la misma salida.
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
