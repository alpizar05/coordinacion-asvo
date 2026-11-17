# Contraste de límites de controles — UX03

17 de noviembre de 2026. Evaluación y corrección local; sin beta, SQL, proveedores, cargas ni correo. Diff previo preservado. El único cambio de aplicación de esta etapa es un bloque al final de app/coordinacion/coordination.css.

## Criterio e interpretación

Referencias consultadas: [WCAG 2.2, criterio 1.4.11](https://www.w3.org/TR/WCAG22/#non-text-contrast), [explicación de contraste no textual y límites](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html#boundaries) y [foco visible 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

El umbral 3:1 corresponde a información visual necesaria para identificar componentes y estados frente a colores adyacentes. No exige un borde alrededor de todo botón si texto/icono identifica suficientemente la acción. Los componentes inactivos están exceptuados; la excepción de apariencia nativa requiere que el autor no la haya modificado. El foco se evalúa por separado y los ratios no se redondean para decidir aceptación.

En la muestra, el campo vacío y textarea blancos sobre blanco dependen del borde para mostrar su área de entrada: 1,4327845879 es insuficiente. Tener una etiqueta externa no delimita esa área. El ajuste compartido también homologa búsqueda, número, fecha, selección y archivo; no se declara que el borde sea normativamente indispensable en cada selector con flecha o botón nativo de archivo.

## Corrección mínima

Bloque `Control boundaries: scoped contrast correction (UX03)`:

- Token de Coordinación --coord-control-border utiliza --gray existente (#6f716d).
- Solo border-color de input/select/textarea de Coordinación; excluye checkbox, radio, hidden, range, color, aria-invalid=true y :disabled.
- --line global (#d4d8d0), fondos, radios, espesores, tamaños, botones y separadores no cambian.
- Errores conservan rojo #852f24 y mensajes; foco conserva outline negro de 3px. No se modificaron reglas de validación, ARIA, formularios, archivos, contexto, contratos ni efectos de negocio.

No hay otra paleta ni normalización de apariencia nativa. Se conserva el verde principal, blanco secundario, rojo destructivo y amarillo semántico/público.

## Inventario y resultados

Inspección de controles y consumidores en Coordinación: entradas sin type (texto), search, number, date, file, hidden, checkbox, select y textarea; acciones y enlaces estilizados como botón; campos y filtros en ActionModal, PhotoDialog, CoordinationModal, RowActionPanel, TableFilters y formularios de editores/registro. La búsqueda actual de type literal no encontró radios activos en Coordinación; el radio del harness es solo diagnóstico y no un nuevo control de producto. Los tipos/contadores estáticos no prueban cada rama renderizada.

Se ejercitaron controles HTML con los estilos reales y los contenedores compartidos reales, no todas las páginas autenticadas de negocio. [17 observaciones CUA con AX y colores](../tests/control-contrast/measurements.json); [510 lecturas de controles/contenedores y ratios](../tests/control-contrast/ratios.json). Las lecturas incluyen elementos de fondo cuando un diálogo está abierto; no son 510 componentes distintos ni auditorías independientes.

| Control / selector y componente | Estado / viewport | Par comparado | Contraste | Criterio y decisión | Evidencia |
| --- | --- | --- | --- | --- | --- |
| input[name=empty], formulario scoped | Vacío sin foco, desktop | #d4d8d0 → #6f716d contra #fefefe | 1,4328 → 4,8892 | Límite necesario de entrada: corregido localmente, supera 3 sin redondeo | before/after-desktop-initial |
| input[name=filled] | Con contenido, desktop | #6f716d / #fefefe | 4,8892 | Mismo patrón; contenido no altera límite | after-desktop-initial |
| search y number | Vacío/0, desktop | #6f716d / #fefefe | 4,8892 | Homologados sin cambiar flechas ni clear nativo | after-desktop-initial |
| input[type=date] | Vacío, desktop | #6f716d / #fefefe | 4,8892 | Borde externo corregido; icono y calendario nativos no se certifican | after-desktop-initial |
| select[name=select] | Opción inicial, desktop | #6f716d / #fefefe | 4,8892 | Homologación; flecha/texto conservados, no afirmar falla independiente de cada select anterior | after-desktop-initial |
| textarea[name=detail] | Vacío, desktop | #d4d8d0 → #6f716d / #fefefe | 1,4328 → 4,8892 | Área de entrada delimitada, corregida | before/after-desktop-initial |
| input[type=file] | Sin archivo, desktop | #6f716d / #fefefe | 4,8892 externo | Solo marco del autor; botón de picker nativo permanece | after-desktop-initial |
| input[name=soft] | Fondo adyacente suave #f3f5ef | #6f716d / #f3f5ef; interior #fefefe | 4,4892 externo; 4,8892 interior | Supera 3 en ambos pares de esta muestra | after-desktop-initial |
| Modal input[name=modal], ActionModal | Normal/error, desktop y móvil | #6f716d / blanco; #852f24 / blanco | 4,8892; 8,5709 | Correcto en contenedor real; texto de error y foco conservados | after-*-modal y modal-error |
| TableFilters select[name=filter] | Inline desktop / modal móvil | #d4d8d0 → #6f716d / #fefefe | 1,4328 → 4,8892 | Corrección compartida alcanza filtros | before-mobile-filters / after-mobile-filters |
| RowActionPanel textarea[name=panel] | Menú desktop / panel al pie móvil | #d4d8d0 → #6f716d / #fefefe | 1,4328 → 4,8892 | Distribuciones deliberadas conservadas | before-mobile-panel / after-*-panel |
| input[name=empty] y textarea con aria-invalid | Error, ambos tamaños | #852f24 / #fefefe | 8,5709 | Ya suficiente antes; explícitamente excluido del cambio, mensajes no dependen solo del color | before/after-*-errors |
| input[name=filled]:focus-visible | Teclado desktop, hover sobre entrada anterior | outline #080907 / #fefefe | 19,7840 | Outline sólido 3px intacto, distinto del borde; comprobación local, no certificación de todo 2.4.7/2.4.13 | after-desktop-hover-keyboard-focus |
| Campo deshabilitado y fieldset en pending | Inactivo | Borde anterior #d4d8d0 / #fefefe | 1,4328 | Exento de 1.4.11; no se impone 3:1, se preserva señal de inactividad | initial / after-desktop-pending |
| checkbox sin/con marca | Native appearance auto, accent #526a3d | Propiedades CSS y captura registradas | No se deduce ratio del glifo de borderColor | Apariencia nativa con accent del autor: no declarar excepción nativa total ni conformidad del glifo a partir de CSS. Sin defecto de borde demostrado, no cambiar | initial antes/después |
| radio diagnóstico | Native appearance auto; sin consumidor activo | Propiedades CSS y captura registradas | No se deduce ratio del glifo | Exclusión deliberada; sin modificación funcional ni nuevo radio de producto | initial antes/después |
| Botón secundario / X / Gestionar | Normal y variantes de contenedor | Borde gris o transparente; texto/icono oscuro sobre blanco | Borde 1,4328 o 1 no implica falla por sí solo | Identificación por contenido visible; conservar borde tenue. Revisar texto/icono por separado | initial, modal, filtros y panel |
| Botón verde / destructivo | Normal, desktop | Verde/blanco y texto rojo/fondo rojo suave | Ver ratios.json | Contenido identifica la acción; borde destructivo no recibe requisito automático 3:1. Sin cambio | initial antes/después |
| .card / fieldset / separadores | Decoración/agrupación | #d4d8d0 / #fefefe | 1,4328 | No son el límite necesario de un control; --line conservado | initial antes/después |
| input[name=public] y botón público | Fuera de .coordination-content | Colores originales | Sin variación | Referencia pública representativa conservada; no visita al catálogo con datos | initial antes/después |

La cifra de foco de la tabla es orientativa; ratios.json contiene valores calculados sin redondeo para los pares de bordes y texto. No se ensayó hover sostenido aislado en cada variante: se registró hover real junto con navegación por Tab; inputs no tienen una regla hover nueva. Active sostenido y cada detalle del menú desplegable nativo quedan fuera de esta medición.

## Evidencia visual

- [Desktop antes](../tests/control-contrast/evidence/before-desktop.png) / [después](../tests/control-contrast/evidence/after-desktop.png): tarjeta y fieldset siguen tenues; campos delimitados.
- [Móvil con errores antes](../tests/control-contrast/evidence/before-mobile.png) / [después](../tests/control-contrast/evidence/after-mobile.png).
- [Filtro móvil antes](../tests/control-contrast/evidence/before-mobile-filters.png) / [después](../tests/control-contrast/evidence/after-mobile-filters.png).

Evaluación visual: la captura permite diferenciar los campos de entrada sin oscurecer toda la página. Es una valoración de esta muestra. No se declara accesibilidad global ni certificación WCAG de pantallas completas.

## Método reproducible

`node tests/control-contrast/fixture.mjs --before` sirve 3041 y retira el bloque UX03 en la copia; sin ese argumento sirve 3042 con el CSS actual. Ambos copian app/lib/public a un directorio desechable, sin dotenv; guard de red externo y base imposible de loopback. Esperar data-contrast-ready=yes. No importa acciones de negocio. Componentes de UI y feedback reales, respuestas ficticias; SIGINT/SIGTERM retira copias. CUA IAB con 1440×900 y 390×844. Esto no es CI de navegador autónoma.

Los objetos de medición reciben la pestaña explícitamente e incluyen URL y viewport; colores computados y cadenas de fondos/transparencias se guardan por control. `node tests/control-contrast/measure.mjs` compone alpha sobre fondos ancestrales, toma canvas blanco y calcula luminancia sRGB y (Lclaro+0,05)/(Loscuro+0,05). Prueba extremos 21/1, confirma baseline y >=3 en entradas corregidas, errores conservados y referencias públicas/decorativas/nativas sin cambio. No atribuye aceptación a grupos con opacity distinta de 1 ni al pintado nativo; no sustituye evaluación contextual. Las imágenes/fondos complejos no aparecen en las superficies muestreadas y requerirían otro análisis.

## Comprobaciones y límites

Node oficial 26.13.1/npm 11.7.0. Nuevos: ci:typecheck correcto, 108 unitarias correctas, test:contracts correcto, lint y format:check correctos en su alcance configurado y test:security:build (Webpack/HTTP aislados) correcto. El primer intento HTTP fue bloqueado por el sandbox y se repitió autorizado. El analizador offline verifica 17 observaciones/510 lecturas. No se agregaron tests de negocio que reproduzcan este cambio CSS ni se ejecutó SQL: no cambian reglas/persistencia.

No se ejecutaron todos los consumidores autenticados (importación, permisos, cada editor, fotos y todos sus estados), otros motores, dispositivo físico, teclado virtual, alto contraste/forced-colors, zoom exhaustivo ni lector hablado. Pendientes separados: matriz completa CUA, native glyphs por motor, indicadores sobre superficies distintas, CI remota, infraestructura y retención. No se altera el comportamiento de formularios ni navegación por un cambio de border-color; las comprobaciones de negocio anteriores siguen como evidencia histórica, no se atribuyen a esta etapa.

UX03 se completa solo para el token y los controles del alcance medido/verificado. Las verificaciones restantes no se marcan completas. Servidores/copias/runtime temporales retirados; quedan harness, datos ficticios de medición, cálculo y capturas. Sin publicación ni cambios en beta/proveedores.
