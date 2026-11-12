# Auditoría del contexto de navegación — 12 de noviembre de 2026

Alcance: las listas de Coordinación implementadas en las tres etapas, con datos ficticios locales. No se publicó, no se cambió beta, no se modificaron roles reales y no se enviaron correos reales.

## Inventario

| Origen | Recorridos con contexto | Criterios/estado | Verificación |
| --- | --- | --- | --- |
| Resumen | bandejas, próximas salidas, seguimiento y consulta de listados → regreso | unidad, periodo, vista y fila | automatizada: tres bandejas, recarga, criterios combinados, guardado/error y cadena con Logística |
| Logística | transporte/alimentación → persona → desglose → origen | pestaña, desglose, fila y posición del diálogo | automatizada en escritorio/celular; vecinos y vacíos de ambos desgloses, historial y pestañas independientes |
| Solicitudes | persona, salida y regreso | estado, unidad, rango de fechas | automatizada: regreso, recarga, teclado, Atrás/Adelante, pestaña independiente, mutaciones y vacío |
| Convocatorias de salida | salida, edición y regreso; eliminación al origen | búsqueda, unidad, estado, visibilidad, orden | automatizada: eliminación y vecino, criterios independientes |
| Series automáticas | serie → bloque → serie → lista | filtros de ambas tablas de Convocatorias | automatizada con fixture propio |
| Series manuales | serie → salida asociada → serie → lista | filtros de ambas tablas de Convocatorias | automatizada con fixture propio; ya no depende solo de revisión de código |
| Voluntariado | ficha → lista; ficha → participaciones → salida → ficha → lista | búsqueda, unidad, página, sección | automatizada: sección, página dos y corrección de última página vacía |
| Informes | resumen del informe, responsable o salida → lista | estado, unidad, rango de fechas e informe seleccionado | resumen/recarga automatizados; responsable/salida comparten enlaces y fueron verificados en la etapa previa |
| Inscripciones de una salida | persona → salida → lista original | estado, pestaña, fila | automatizada: varios niveles y secciones por fragmento |
| Participaciones de una persona | salida o asistencia → persona → Voluntariado | sección y fila | participación automatizada; enlace de asistencia revisado con el mismo componente |

No se agregaron paginación, preferencias, consultas de negocio ni permisos nuevos. La paginación existente de Voluntariado sigue siendo de 25 personas.

### Pendientes y navegación intencionalmente habitual

- Resumen y Logística ya están migrados. Los nombres que eran texto en Resumen siguen como texto, sin inventar identificadores de ficha ni ampliar las consultas del dashboard.
- Breadcrumbs, menú global, portal público, crear/clonar, Administración/importaciones y Bandeja de prueba mantienen sus rutas propias. No se inventa una procedencia ni se fuerza el comportamiento de una lista en esos flujos.
- La matriz de navegadores/dispositivos, lectores reales y ejecución autónoma en CI está pendiente.

## Hallazgos corregidos

1. El almacén aceptaba objetos estructuralmente válidos con propiedades adicionales. Ahora copia únicamente rutas/criterios permitidos, referencias internas, posición y fecha; descarta datos de formularios/respuestas o atributos ajenos.
2. Las búsquedas libres podían copiar identificaciones o correos a sessionStorage. **Todo contexto que contenga `buscar`, `salidaBuscar` o `serieBuscar` se conserva solo en memoria.** Al recargar un detalle de ese recorrido, se usa la navegación habitual, sin inventar un regreso con criterios incompletos. La búsqueda de la propia lista sigue en su URL, como antes. Esta es una limitación explícita de continuidad por privacidad; no se cifra información con una clave almacenada junto a ella ni se simula una protección inexistente.
3. Los enlaces de regreso revalidan caducidad al activarse; las claves de almacenamiento y los identificadores de contexto tienen validación propia.
4. Se rechazan rutas externas, no admitidas, UUID malformados, recorridos ambiguos, controles y criterios duplicados. Las transiciones de edición también usan un destino seguro.
5. Un popstate que solo cambiaba el fragmento podía dejar una bandera que afectara al filtro siguiente. Ahora se compara el destino concreto del historial.
6. Un modal abierto aplaza la restauración; un error de campo la cancela. Cerrar un panel de guardado no consume prematuramente la restauración antes del refresco de resultados.
7. Los enlaces a secciones conservan el contexto, sincronizan la pestaña real con la URL y dejan los destinos de Inscripciones por debajo del encabezado fijo móvil.

## Pruebas

- **20 pruebas unitarias separadas**, mediante `node:test`: normalización, rutas permitidas, claves, separación por usuario, conservación por criterio, caducidad, límites, almacenamiento bloqueado/corrupto/cuota, privacidad de búsquedas, proyección de campos, cadenas/ciclos, vecinos y listas vacías, solicitudes obsoletas, prioridad de errores/modales y bloqueo del controlador frente a beta/no-demo.
- **26 escenarios de navegador automatizados**, mediante el controlador CUA disponible. Incluyen teclado y foco, regreso contextual, recarga, Atrás/Adelante, entrada directa, pestaña independiente, varios niveles, series manuales y automáticas, informes, criterios combinados, confirmación/cancelación/rechazo, reintento tras error, fila que permanece, fila que desaparece, lista vacía, eliminación y última página fuera de rango.
- Accesibilidad comprobada por árbol, nombres/roles, `aria-invalid`, `aria-describedby`, resumen navegable y Escape. Distribución móvil a 390 × 844 sin desbordamiento horizontal. No equivale a escuchar un lector real ni a probar todos los dispositivos.
- Las búsquedas en memoria se prueban tanto funcionalmente durante el recorrido como en su fallback tras recarga; la memoria no se comparte con pestañas nuevas. Las rutas sin búsqueda sí recuperan contexto tras recarga desde sessionStorage.

El informe reproducible está en [tests/navigation/browser-results.json](../tests/navigation/browser-results.json) y las instrucciones en [tests/navigation/README.md](../tests/navigation/README.md). Las pruebas de navegador requieren el entorno CUA; todavía no son un trabajo autónomo de CI.

La cobertura unitaria se mide exclusivamente sobre los dos módulos puros de navegación; **no es una medición de cobertura de la plataforma ni de los componentes React**. El comando es `npm run test:navigation:coverage`. No se marca completa la tarea global de separar todas las validaciones unitarias.

Se ejecutan además TypeScript, compilación, comprobación del diff y regresiones locales de inscripciones para comprobar que no cambian permisos, transacciones, cupos, espera, auditoría o notificaciones. El fixture bloquea entornos ajenos a demo local y su limpieza comprueba cero correos reales.

### Resultado final de comprobaciones

- TypeScript, compilación de producción y `git diff --check`: correctos.
- Suite unitaria aislada: 20/20 correctas. Cobertura de `navigation-context.ts` y `navigation-store.ts`: líneas 100 %, ramas 93,92 %, funciones 97,06 %. No incluye React/DOM ni el resto del sistema.
- Navegador: 25/26 escenarios correctos; regreso/historial y cadena de varios niveles reejecutados tras las correcciones finales y con la protección demo activa.
- Regresiones locales de inscripciones y formularios de Coordinación: correctas, incluyendo permisos, versiones obsoletas, dos decisiones concurrentes, cupos/espera, auditoría y notificaciones demo.
- Fixture retirado. Su limpieza comprobó cero correos reales enviados. No se publicó ni se subió a GitHub.


### Verificación de la extensión

La extensión reutiliza el contrato y el almacén: solo agrega `/coordinacion`, sus criterios, el enum `desglose`, prefijos de filas y el desplazamiento numérico opcional del diálogo. Se verificó que propiedades ajenas (incluida alimentación/correo) no se proyecten, y que contextos de ambos desgloses tengan destinos/etiquetas distintos. No cambian consultas, permisos, cupos, cola ni notificaciones.

El fixture ahora crea cuatro salidas (dos de 2035, una próxima según fecha local y una pasada), nueve inscripciones y 28 personas ficticias `.test`. Las operaciones `logistics-next`, `logistics-empty`, `logistics-reset` y `restore-empty` actúan solo sobre sus UUID registrados. Se probaron desaparición y vacío de transporte en escritorio y de alimentación en celular. La gestión desde Resumen conservó filtros/periodo/vista y priorizó el error de Motivo antes del reintento confirmado.

Resultado de esta extensión: 20/20 unitarias; 26/26 grupos de navegador (incluyen los 14 anteriores reejecutados); TypeScript, compilación y diff correctos. Regresiones locales de formularios/inscripciones correctas. Se retiraron los fixtures y se comprobó cero correos reales. Continúan pendientes CI autónomo, lectores reales y matriz de navegadores/dispositivos. No se publicó ni se subió a GitHub.
