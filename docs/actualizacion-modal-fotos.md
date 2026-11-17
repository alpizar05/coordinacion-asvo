# Actualización local del modal de fotos

16 de noviembre de 2026. UX01 y UX02 implementadas en el componente compartido. Sin beta, SQL, Graph, correo, cargas reales ni publicación.

## Implementación

PhotoDialog conserva su portal en document.body y recupera el alcance `.coordination-content` alrededor de CoordinationModal. Reutiliza los tokens y variantes existentes: principal verde, secundarias blancas, X sutil de 44 px y descarte rojo. El fieldset usa la distribución compartida; las pestañas seleccionadas usan los tokens verde y hover vigentes. No se modificó el amarillo global del portal público ni CoordinationModal/ActionModal.

Galería y Subir nueva quedan deshabilitadas durante pending. Se mantienen busy, finally, validación, contratos de preparación/persistencia, archivos, metadatos, autorización y límites. La preparación sigue sin equivaler a persistencia. No se cambiaron herencia, consultas, transacciones, notificaciones ni proveedores.

CUA detectó que desmontar el portal dejaba el foco en body tras cerrar. PhotoDialog ahora devuelve el foco a su disparador con preventScroll, únicamente después de haber estado abierto. No lo toma al montar la página.

El inventario estático mantiene cinco usos en tres módulos: attach-photos, outing-editor y new-outing-form. Todos reciben el componente actualizado; no se abrió cada página autenticada de negocio.

## Evidencia visual y de interacción

[Resultados: 40 observaciones](../tests/photo-dialog/browser-results.json). Componentes reales, callbacks y persistencia simulados, imágenes ficticias locales. CUA en 1440×900 y 390×844. El harness compara HEAD 3e0a187 con la implementación local en copias desechables.

- [Antes desktop](../tests/photo-dialog/evidence/before-desktop.png) / [después desktop](../tests/photo-dialog/evidence/after-desktop.png).
- [Antes celular](../tests/photo-dialog/evidence/before-mobile.png) / [después celular](../tests/photo-dialog/evidence/after-mobile.png).
- [Guardando en celular](../tests/photo-dialog/evidence/pending-mobile.png) y [descarte rojo](../tests/photo-dialog/evidence/discard-mobile.png).

Se ejercitaron galería, subida y edición; errores generales y múltiples campos simultáneos; corrección independiente; resumen que enfoca el campo; archivo y metadatos conservados; rechazo y respuesta indefinida; reintento; preparación y persistencia exitosas simuladas. Doble clic durante respuestas demoradas invocó una sola vez el callback y bloqueó ambas pestañas. Se verificaron recuperación de controles y retorno al disparador tras éxito, Escape limpio y descarte.

La galería larga mantuvo el campo enfocado entre encabezado y pie en ambos viewports, sin desbordamiento horizontal ni formularios anidados. Se inspeccionaron asociaciones ARIA y teclado, sin lector de pantalla hablado. La comparación de ActionModal y de botones públicos representativos conservó colores y dimensiones; no constituye una visita al catálogo público con base de datos.

Los registros iniciales anteriores a la corrección del retorno de foco se conservan como evidencia histórica. El harness agregó un marcador de hidratación después de una selección demasiado temprana; los casos de éxito se repitieron tras esperar dicho marcador. Los contadores se reinician en focus-fix-reloaded.

## Comprobaciones automatizadas

Node 26.13.1 y npm 11.7.0:

- `npm run ci:typecheck`: correcto en copia limpia.
- `npm run test:unit:coverage`: 108 pruebas correctas. Los 39 módulos puros declarados tienen 100 % líneas, 96,77 % ramas y 99,56 % funciones; no es cobertura global ni de React.
- `npm run test:contracts`: correcto, incluidos los contratos negativos de fotos y fronteras servidor.
- `npm run lint`: 359 archivos, sin errores.
- `npm run format:check`: correcto para el alcance configurado del comando.
- `npm run test:security:build`: Webpack de producción y HTTP aislados correctos, sin proveedores ni base de aplicación.

No se ejecutó integración SQL: esta etapa no cambia persistencia ni reglas de dominio. Los callbacks UI no prueban un commit ni ausencia absoluta de efectos posteriores a él.

## Reproducción y límites

`node tests/photo-dialog/fixture.mjs` crea una copia temporal en puerto 3037; `--before` compara HEAD en 3038. Esperar data-photo-ready=yes. Su API de fotos devuelve exclusivamente un PNG ficticio local; el guard existente bloquea red externa. SIGINT/SIGTERM elimina la copia. Ambos procesos de esta revisión terminaron y confirmaron su limpieza. No es una suite de navegador autónoma en CI: depende de CUA.

Pendientes independientes: matriz completa de consumidores autenticados, otros navegadores, dispositivos físicos, teclado virtual, lector de pantalla y zoom exhaustivo. No se comprobó retorno al disparador cuando el consumidor lo deshabilita al alcanzar seis fotos. En los límites de tabulación nativa y al desmontar Seguir editando en el descarte compartido se observó body; no se afirma una trampa personalizada ni accesibilidad integral resuelta. UX03/UX04, CI remota, infraestructura y retención permanecen abiertos.


## Reauditoría del bloqueo — 17 de noviembre de 2026

**Sin cambios funcionales nuevos.** Se revisaron PhotoDialog, CoordinationModal, los cinco usos de tres módulos, checkedPhotoResult y las pruebas de contratos. Se preservó íntegramente el diff anterior. La única ampliación del harness es `delay-retry-success`: demora cinco segundos, falla el primer intento y permite un segundo éxito con los mismos datos; no modifica el componente ni simula reglas de negocio.

### Evidencia nueva

[19 observaciones con URL, viewport, estado y AX](../tests/photo-dialog/audit-20261117-results.json). CUA IAB, 1440×900 y 390×844, componentes reales, PNG ficticio seleccionado mediante file chooser y callbacks simulados. No hay SQL, Graph, cargas ni correo real.

| Caso | Resultado nuevo |
| --- | --- |
| Galería desktop: doble clic, clic forzado en Subir nueva y Escape durante pending | Ambas pestañas deshabilitadas, modo conservado, diálogo abierto y una sola invocación. Error general y dos campos; controles recuperados; metadatos conservados |
| Reintento de preparación desktop | Dos invocaciones totales, una preparación y cero guardados. Cierre solo después de prepared explícito; foco vuelve al disparador |
| Subida desktop: doble clic y clic forzado en Galería | Ambas pestañas deshabilitadas, modo subida conservado y una sola invocación adicional. La pestaña dejó de estar disponible después de estas mediciones; no se atribuye a esta ejecución desktop la recuperación posterior |
| Galería celular: demora/error/reintento | Pestañas y Escape bloqueados; error conserva selección y metadatos; resumen enfoca crédito. Reintento conserva pending y luego confirma un guardado simulado |
| Subida celular: demora/error/reintento | Una invocación con doble clic; conserva fixture.png, descripción, crédito y autorización marcada tras fallo. ARIA-invalid y referencias aria-describedby válidas; recupera controles y permite reintentar |
| Descarte abierto antes de reintentar la subida | X, Cancelar, ambas pestañas, Seguir editando, Descartar cambios y submit deshabilitados durante pending. Los botones del resumen de errores siguen disponibles para navegación: no cambian la operación ni sus datos |
| Rechazo inesperado y respuesta indefinida | Errores generales sin cierre ni falso éxito, datos conservados y controles habilitados. Guardadas permanece en 2 para ambos fallos |

[Desktop guardando](../tests/photo-dialog/evidence/audit-20261117-desktop-pending.png), [celular guardando](../tests/photo-dialog/evidence/audit-20261117-mobile-pending.png) y [descarte bloqueado](../tests/photo-dialog/evidence/audit-20261117-discard-pending.png).

El guard busy se establece antes de decodificar la imagen y llamar al callback; finally libera busy/pending incluso en retornos de validación de imagen. Los resultados atraviesan checkedPhotoResult: preparación y persistencia no son intercambiables. No se infiere éxito de strings, respuestas ausentes o mensajes. No hay cambios de contratos, permisos, herencia, transacciones o notificaciones. Esta evidencia demuestra bloqueo local del formulario, no idempotencia global ni persistencia real.

### Comprobaciones nuevas y límites

Node 26.13.1 oficial verificado por SHA256 y npm 11.7.0: ci:typecheck, 108 unitarias, test:contracts y lint correctos. La suite incluye contratos negativos de fotografías y reglas puras de validación. No se repitió build ni integración SQL: no se cambió código funcional; el build del 16 de noviembre es evidencia histórica, no una ejecución nueva.

Una espera del navegador devolvió timeout antes de terminar la demora; se verificó el estado posterior mediante AX y contadores. Una pestaña se perdió después de la subida desktop; se guardó la evidencia obtenida y se usó otra pestaña para móvil, con contadores reiniciados. Los objetos de inspección reciben el handle de pestaña explícitamente para no mezclar evidencia. La selección de archivos tuvo demoras de la herramienta; los estados se comprobaron al regresar.

No se repitieron los cinco recorridos autenticados completos, dispositivo físico, lector hablado, otros navegadores ni toda la matriz de foco/zoom. La evidencia del 16 de noviembre y la revisión de paneles se conserva como histórica separada. No se declara ausencia de efectos posteriores a un commit: aquí no hubo persistencia, solo callbacks UI. Se retiraron servidor, copia y archivos/runtime temporales. Sin publicación ni cambios en beta/proveedores.
# Aclaración de inventario posterior

La ejecución de rutas del 17/11 distingue cinco sitios de uso en código de cuatro activos en alta/editor. AttachPhotos permanece implementado, pero sus montajes en el detalle no son alcanzables por la condición editing/information; su contrato no se retiró. Ver [matriz de convocatorias, series y fotos](matriz-visual-convocatorias-series-fotos.md). La evidencia histórica de este documento se conserva con su alcance original.
