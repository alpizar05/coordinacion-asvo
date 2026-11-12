# Contexto de navegación de Coordinación

## Patrón compartido

`NavigationContextProvider`, `ContextDetailLink` y `ContextReturnLink` conservan la procedencia en sessionStorage, por usuario y pestaña, con hasta 20 contextos vigentes durante 30 minutos. Cada contexto contiene una cadena plana de hasta ocho marcos: ruta interna con criterios permitidos, identificador DOM del registro y posición. La URL del detalle lleva un único `navContext` aleatorio; nunca URLs de regreso anidadas.

Al abrir un detalle desde otro, se incorpora el marco de origen. Al regresar, se extrae un marco y se conserva el resto de la cadena. Si se visita una ruta ancestral, la cadena se recorta antes de ese destino para evitar ciclos; al superar ocho niveles se usa la navegación habitual. Las entradas directas, contextos vencidos, almacenamiento bloqueado o enlaces abiertos en otra pestaña sin contexto disponible mantienen breadcrumbs y navegación normales. El identificador no concede permisos: las páginas conservan su autorización de servidor.

El almacén proyecta únicamente metadatos de navegación. No persiste fichas, formularios, tokens privados, respuestas del servidor ni búsquedas libres; los contextos con búsquedas se mantienen solo en memoria y no sobreviven a una recarga del detalle. Las referencias internas y los demás criterios permitidos pueden persistirse. El almacén de contexto no usa localStorage; Resumen conserva únicamente su preferencia previa de unidad/periodo/vista en el mecanismo ya existente. Desde la auditoría integral, los contextos que contienen búsquedas libres son solo de memoria; ver el límite de recarga en la auditoría. Cambiar usuario elimina los contextos de otros usuarios en esa pestaña.

## Rutas y criterios conservados

| Vista de origen | Criterios | Destinos cubiertos |
| --- | --- | --- |
| Resumen | unidad, dias (7/14/30), pestana (revision/sin70/informes) | bandejas, próximas salidas y consultas a listados |
| Logística de una salida | pestana=logistica, desglose (transporte/alimentacion) | persona desde cada desglose |
| Solicitudes de inscripción | estado, unidad, desde, hasta | persona, salida |
| Convocatorias de salida | búsqueda, unidad, estado, visibilidad y orden | salida |
| Convocatorias en serie | búsqueda, tipo y disponibilidad pública | serie automática o manual; sus bloques |
| Voluntariado | buscar, unidad, pagina | ficha de persona |
| Informes de salida | estado, unidad, desde, hasta | responsable, salida y Ver informe |
| Inscripciones de una salida | estado, pestana | persona |
| Participaciones de una persona | seccion | salida y revisión de asistencia |

Las dos tablas de Convocatorias comparten una página: sus parámetros tienen prefijos `salida` y `serie` para mantener ambos grupos independientes. Los filtros y ordenaciones siguen siendo locales sobre los mismos datos ya cargados; `history.replaceState(null,...)` los sincroniza con el router de Next sin agregar consultas, paginación ni preferencias persistentes. Se mantiene el mismo filtrado, valores predeterminados y orden. La sección de la ficha se refleja en `seccion` solo en el visor de personas, sin alterar editores que reutilizan SectionWorkspace.

Ejemplos de enlaces contextuales: «Volver a convocatorias en serie», «Volver a voluntariado», «Volver a informes de salida», «Volver a inscripciones de la salida» y «Volver a participaciones de la persona voluntaria». El breadcrumb sigue representando la jerarquía habitual.

## Restauración y seguridad

`ListPositionRestorer` se monta una sola vez en el proveedor. Solo actúa al usar el regreso contextual y cuando la ruta y criterios coinciden. Espera dos cuadros de renderizado tras el montaje, restaura la posición relativa del registro y enfoca su primer enlace sin otro desplazamiento. Si el registro no está, prioriza los siguientes identificadores capturados, luego los anteriores y finalmente el índice disponible en esa misma tabla. Si la tabla queda vacía, ubica su región; si no existe una región, usa el desplazamiento previo limitado por el navegador. Las pestañas/secciones se recuperan de la URL antes de ubicar la fila.

No intercepta popstate ni cambia history.scrollRestoration; Atrás/Adelante usa la restauración de Next/navegador. El normalizador usa una lista explícita de rutas y criterios: descarta notificaciones, edición y parámetros de retorno; rechaza rutas externas o no admitidas, fragmentos, barras invertidas, duplicados y valores demasiado largos. Los destinos de detalles admitidos son fichas, salidas/resúmenes y series; no enlaces privados ni Administración. La cadena valida caducidad, longitud, registros y ausencia de ciclos.

## Alcance y límites

Cubiertos los enlaces de consulta enumerados, incluyendo lista → salida → persona → regreso a salida → lista y Voluntariado → persona → participación/salida → regreso. Las acciones de editar, clonar, crear, modificar estados o generar enlaces siguen sus flujos existentes; no se interceptan ni se les agrega contexto automáticamente. Se incorporaron el regreso al siguiente registro cuando desaparece, la corrección de páginas fuera de rango y la preservación después de guardados confirmados. Si cambia la altura tardíamente o el tamaño de pantalla durante el recorrido, la posición puede variar. La apertura en otra pestaña no requiere acceso al almacenamiento de la pestaña original y siempre permite consultar el destino con sus permisos normales.

Pruebas puras: `node scripts/test-navigation-context.mjs` (sin base/red/credenciales). Comprobaciones: `npm run check`, `npm run build`, `git diff --check`. Pruebas de navegador con datos demo locales, sin escrituras ni correos. La revisión asistida no sustituye lectores de pantalla o pruebas en dispositivos reales.

## Verificación de recorridos

En demo local, con datos ficticios y sin escrituras ni mensajes:

- Escritorio: búsqueda y orden de Convocatorias conservados en URL; Convocatorias → salida → persona → salida → lista, con recuperación del registro y foco.
- Escritorio: filtro de series → serie automática → bloque → serie → lista; conserva también los filtros independientes de Convocatorias en la misma página.
- Escritorio: búsqueda/unidad/página de Voluntariado → persona → Participaciones → salida → persona → Voluntariado; recupera `seccion=participations`, la fila y los criterios de búsqueda.
- Móvil a 390 × 844: Informes con rango de fechas → Ver informe → lista, e Informes → responsable → lista; criterios, fila y foco recuperados, sin desbordamiento horizontal.
- Apertura independiente de una ficha con un identificador de contexto ajeno a esa pestaña: consulta normal sin inventar enlace contextual.
- Pruebas puras: rutas de series manuales y automáticas, paginación y criterios, cadena de varios niveles, poda de ciclos, límite de ocho marcos, caducidad y rechazo de destinos no admitidos.

En esa etapa inicial no había una serie manual local. La auditoría integral posterior agregó un fixture propio y verificó automáticamente esa variante. Tampoco se verificó una matriz exhaustiva de navegadores, lectores de pantalla reales ni cambios concurrentes del contenido durante el recorrido.

La regresión Solicitudes → persona → Solicitudes también se verificó con la base extendida: se recuperaron `estado=todos`, desplazamiento y foco en el registro original.


## Cambios de resultados, filtros y guardados

Cada marco puede conservar el nombre de la tabla, el índice de fila y hasta ocho identificadores siguientes y ocho anteriores. Solo son referencias internas; no se almacenan nombres ni datos de las filas. La elección se prueba en `chooseNavigationAnchor` y se aplica exclusivamente a esa tabla.

Los formularios de Coordinación capturan la posición al intentar enviar. **No basta con enviar ni con cerrar un modal:** los handlers publican `navigationSaved()` únicamente después de `result.saved`. Los marcadores `NavigationResults` anuncian el montaje de los resultados actualizados. La posición se conserva al cerrar el diálogo y se ajusta cuando llega el refresco; si la fila desaparece se enfoca la siguiente disponible. La franja de éxito no se usa como señal, porque también sirve para copiar enlaces.

El patrón está conectado a gestión, alta y edición de inscripciones, ActionModal y formularios de registro, decisiones de agrupación, enlaces privados y adjuntos guardados en servidor. La preparación local de fotos no se anuncia como una escritura. Las transiciones dentro del mismo detalle conservan sus criterios y `navContext`; eliminar una salida vuelve al origen validado cuando existe, en lugar de perder sus filtros en una lista genérica.

Un error con foco emite `asvo:form-errors`: invalida cualquier restauración y deja el formulario abierto con sus datos. Los diálogos restituyen el foco con `preventScroll`. Los clics de navegación, historial nativo y nuevas interacciones cancelan solicitudes anteriores; cada restauración comprueba destino, caducidad y generación antes de ejecutarse. Se usan desplazamientos instantáneos, incluso si existe un estilo global de desplazamiento suave; no se agrega animación a quienes prefieren movimiento reducido.

Cambiar filtros, búsqueda, orden o página lleva al comienzo de los resultados de la lista afectada, sin enfocar otro control. En Convocatorias, los filtros de series llevan a series y los de salidas a salidas. En celular se espera el cierre del modal de filtros. Cambiar solo una pestaña/sección no reinicia una lista. Voluntariado conserva su reinicio de página al buscar/filtrar y su límite de 25 registros. El servidor ya calcula la última página válida: `NavigationPageBoundary` refleja esa página en la URL conservando sus demás parámetros, sin otra consulta. Si se perdió la última página al regresar, se prioriza la última fila disponible; la corrección de URL no dispara un segundo salto al inicio.

Los contextos se purgan al cambiar de usuario, al cerrar sesión y periódicamente por caducidad. El almacenamiento sigue separado por pestaña y sujeto; no se cambian permisos ni reglas de negocio.

### Verificación de modificaciones

Se crearon exclusivamente en PostgreSQL demo local 28 personas, dos salidas y seis inscripciones ficticias, con destinatarios `.test`. Se verificaron:

- Confirmar desde «En revisión»: desaparece la fila, se mantienen criterios y se enfoca la siguiente.
- Cancelar sin motivo: foco en Motivo, panel abierto y posición estable; corregir y cancelar conserva filtros y pasa a la siguiente fila.
- Confirmar con «Todos»: la fila permanece, junto con su foco y desplazamiento.
- Anterior/Siguiente: inicio de resultados, conservando búsqueda y unidad.
- Eliminar las tres personas de la página 2: regreso a página 1, criterios conservados y última persona disponible visible. Se corrigió y repitió un caso en que un segundo reinicio dejaba esa persona fuera de pantalla.
- Móvil: cancelar el último resultado de Confirmadas deja una tabla vacía accesible, con los mismos criterios; modificar filtros en su modal recupera los resultados y cierra sin arrastrar una posición anterior.
- Eliminar una convocatoria sin inscripciones desde edición: vuelve a la búsqueda de origen y enfoca la siguiente convocatoria.
- Pruebas puras de vecinos, lista vacía, criterios/paginación, separación de tablas, edición con contexto y caducidad; regresiones del dominio en base local.

El fixture reproducible está en `scripts/test-navigation-fixture.mjs` (`prepare`, `grow`, `shrink`, `cleanup`), con bloqueo de entornos que no sean demo local. La limpieza elimina exclusivamente los identificadores registrados en su archivo temporal ignorado por Git y comprueba cero correos reales enviados. No ejecutar este script con datos beta. Las comprobaciones de sesión corresponden a la separación y caducidad del contrato y a revisión de los handlers; no se alteraron roles ni se probaron sesiones institucionales reales. Las pruebas de navegador siguen siendo asistidas; falta automatizarlas y ampliar la matriz de dispositivos/lectores.

## Auditoría integral posterior

La [auditoría del 12 de noviembre](auditoria-contexto-navegacion.md) inventaría recorridos, pendientes, correcciones de privacidad/seguridad y las suites unitaria y de navegador. Sustituye las limitaciones de verificación inicial donde se indica expresamente; mantiene pendientes los lectores reales, más dispositivos y CI autónomo.


## Extensión a Resumen y Logística

Resumen incorpora ambas listas al mismo capturador/restaurador: `summary-attention` y `summary-upcoming`, con identificadores diferenciados por bandeja. Los enlaces existentes a salidas, seguimiento, logística y listados de consulta usan el mismo `ContextDetailLink`. El regreso dice «Volver a Resumen» y conserva unidad, periodo y vista. Si la entrada no contiene criterios explícitos, se materializan los valores ya elegidos por servidor/preferencias en la URL; no se agrega otra preferencia ni consulta. Esa materialización utiliza la señal compartida de corrección de URL para evitar un salto de desplazamiento durante la entrada inicial. Los nombres personales del dashboard que antes eran texto siguen siéndolo: la proyección existente no proporciona el UUID de la ficha y no se cambiaron consultas de negocio para inventar ese vínculo.

Transporte y alimentación usan identificadores `transporte-UUID` y `alimentacion-UUID`, distintos de `inscripcion-UUID`. El parámetro permitido `desglose` identifica la sección abierta: detalles en escritorio, diálogo en celular. Salir de Logística mediante una pestaña cierra ese desglose; consultar una ficha conserva su origen. El regreso «Volver a logística de la salida» recupera pestaña, desglose, fila y, si corresponde, desplazamiento numérico del diálogo (`panelY`). No se almacenan nombres, correos, textos alimentarios, datos médicos ni contenido de celdas.

El restaurador compartido ahora reconoce filas de tabla y elementos marcados de listas. Solo permite el foco dentro del diálogo de desglose que coincide con el origen; otros modales aplazan la restauración y los errores la invalidan. La salida hacia una ficha no borra el criterio del desglose ni roba foco al desmontarse. Si desaparece la fila se aplica el mismo orden de vecinos; si desaparece todo el desglose se enfoca su mensaje vacío. Los cambios de vista de Resumen reinician el comienzo de su bandeja; cambiar únicamente desglose/pestaña de la salida no reinicia Inscripciones.

Se verificaron con CUA las tres bandejas, filtros combinados, recarga, consulta a Convocatorias, cadena Resumen → salida → Logística → persona → Logística → Resumen, transporte/alimentación por separado, modales móviles, Atrás/Adelante, pestaña independiente, guardado y error desde Resumen, filas desaparecidas y desgloses vacíos. Las acciones de creación, los enlaces públicos, breadcrumbs y secciones continúan su navegación habitual. El contexto sigue siendo una cadena plana acotada y no reemplaza permisos.
