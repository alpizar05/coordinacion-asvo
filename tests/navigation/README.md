# Pruebas de contexto de navegación

## Unitarias aisladas

```sh
npm run test:navigation:unit
npm run test:navigation:coverage
```

Usan `node:test`, sin PostgreSQL, red, navegador ni credenciales. Se inyectan reloj y almacenamiento falsos. `register.mjs` resuelve únicamente la importación TypeScript de estos módulos para Node; no sustituye funciones del dominio. El script anterior `scripts/test-navigation-context.mjs` delega en esta suite.

La cobertura incluye **solo** `lib/navigation-context.ts` y `lib/navigation-store.ts`. No mide los componentes React, DOM, reglas de inscripción ni la plataforma completa; no se fijan umbrales globales a partir de esta medición.

## Navegador con las herramientas disponibles

`browser.mjs` exporta `createNavigationBrowserSuite`. Recibe una pestaña CUA, la capacidad viewport, una función de creación de pestañas y los identificadores del fixture. Utiliza exclusivamente su API documentada de accesibilidad y Playwright. Las activaciones de enlaces se hacen mediante el árbol de accesibilidad y se verifica la URL final; los controles, campos y comprobaciones DOM usan localizadores. No ejecuta JavaScript de escritura dentro de la página.

Se rechazan destinos ajenos a `http://localhost:3031` y aplicaciones sin el marcador de demo que emite el servidor. Los casos negativos de este contrato se prueban con un doble del controlador, sin tocar beta. No se guardan cookies, secretos, tokens ni capturas de fichas en el informe.

Preparación y limpieza, exclusivamente con PostgreSQL demo local:

```sh
node --env-file=.env.local scripts/test-navigation-fixture.mjs prepare
# Ejecutar basics, independent, chain, participations, series, reports,
# mobileMutations, savedVisible, emptyResults, deletion y beforeShrink.
node --env-file=.env.local scripts/test-navigation-fixture.mjs shrink
# Ejecutar afterShrink, accessibility y sections.
node --env-file=.env.local scripts/test-navigation-fixture.mjs cleanup
```

En una sesión CUA, importar `browser.mjs`, leer el archivo local ignorado `.env.navigation-fixture.json` e inyectar sus datos. Ejemplo de construcción una vez que la pestaña y las capacidades ya están disponibles:

```js
const suite = createNavigationBrowserSuite({ tab, fixture, viewport, createTab });
await suite.basics();
await suite.chain();
// Ejecutar los demás grupos en el orden descrito arriba.
```

`browser-results.json` contiene el resultado de los 26 grupos de escenarios ejecutados el 12 de noviembre de 2026. La suite hace confirmaciones, cancelaciones y eliminación **solo sobre los registros ficticios identificados en el fixture**; no debe ejecutarse con identificadores elegidos de beta. La limpieza verifica cero correos reales y retira datos, informes, colección manual, auditoría y notificaciones demo asociados.

### Límites

La ejecución del navegador depende de una sesión CUA inicializada y de su conexión con el navegador; **no hay todavía un comando CLI/CI autónomo para ella**. No se instaló Playwright ni se descargaron navegadores. El árbol de accesibilidad, las asociaciones ARIA y el foco se prueban automáticamente, pero la voz y experiencia de lectores reales no. No se modificaron roles institucionales ni se ejecutaron cambios de cuenta reales: la separación, caducidad y cierre del almacén se prueban unitariamente. Una matriz entre Safari, Firefox, Chrome y dispositivos físicos sigue pendiente.

Medición inicial registrada el 12 de noviembre de 2026: 20 pruebas, 100 % de líneas, 93,92 % de ramas y 97,06 % de funciones **en los dos módulos puros indicados**. Esta cifra no afirma cobertura completa de navegación ni del producto.


### Resumen y Logística

Ejecutar `summaryDefaults` para comprobar que cargar las preferencias existentes no desplaza la página. Antes de las mutaciones del fixture, ejecutar `summary`, `logistics`, `mobileLogistics`, `logisticsHistory` y `summarySave`. Este último cancela exclusivamente la inscripción ficticia de Resumen y verifica su error/reintento. `summary` recarga cada detalle de las tres bandejas; los criterios combinados se comparan tras regresar.

Para los vecinos/vacíos de transporte: ejecutar `logisticsBeforeRemoval()`, comando `logistics-next`, `logisticsAfterRemoval()`, comando `logistics-empty`, `logisticsAfterEmpty()`. Reponer con `logistics-reset` y repetir en viewport móvil usando `logisticsBeforeRemoval('alimentacion')`, `logisticsAfterRemoval('alimentacion')` y `logisticsAfterEmpty('food')` entre los mismos comandos. Estas modificaciones solo afectan a los UUID del fixture. `restore-empty` repone la salida ficticia eliminable si es necesario repetir esa prueba. Siempre finalizar con `cleanup`.

El controlador deriva la fila vecina de eliminación del DOM actual en lugar de fijar un nombre: Resumen agrega salidas según calendario y cambia el orden del fixture. Cuando accesibilidad abrevia la URL, el enlace se identifica por su nombre visible y ordinal en el DOM, y siempre se verifica la URL final. No se leen cookies, almacenamiento ni estado interno de React en el navegador.
