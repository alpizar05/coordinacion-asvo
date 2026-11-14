# Contratos de ActionModal y wrappers (C02)

Revisión local terminada el 14 de noviembre de 2026; trabajo iniciado el 13. Sin publicación, beta ni proveedores reales. Continúa las etapas E1 y E2 del [inventario](inventario-contratos-heredados.md).

## Alcance y equivalencia

Se sustituyó `Promise<unknown>` y el cast de ActionModal por `Promise<FormResult>`, con propiedades exportadas y reutilizadas por RegistryModal. Los seis consumidores activos (ficha, unidades, póliza, conciliación, recordatorio y separación de agrupación) ya producían resultados compatibles: no fue necesario cambiar sus servicios.

`checkedFormResult` valida la estructura del contrato existente en la frontera de consumo. Solo `saved === true`, sin errores contradictorios, confirma. Una respuesta ausente, string, saved truthy o estructura inválida devuelve un error general seguro y conserva el formulario. No interpreta mensajes ni convierte consultas a FormResult. Proyecta solo feedback y destino: los payloads adicionales siguen permitidos en los productores, pero estos wrappers no los consumen. RegistryForm inline reutiliza esa protección; SplitGroupForm comprueba éxito literal antes de conservar el destino contextual.

Se mantienen apertura local/controlada, validación previa, errores múltiples, secciones ocultas y foco, archivos seleccionados, dirty/inFlight, filtros y mecanismos existentes de navegación. Incidentes solo se limpian tras éxito. No se modificaron permisos, transacciones, bloqueos, auditoría, cola, cupos, estados, herencia, HTTP ni redirects. Los adaptadores internos de compatibilidad siguen teniendo consumidores y no se retiraron. PhotoDialog y demás familias quedan fuera del alcance.

## Evidencia automatizada local

Con Node.js 26.13.1, npm 11.7.0, PostgreSQL 18.7 desechable y Next.js 16.4.5:

- TypeScript en copia fresca, incluyendo `tests/types/action-modal-contract.ts`: admite FormResult/payloads compatibles y rechaza void, strings, unknown y saved no literal.
- 99 pruebas unitarias, 36 módulos explícitos: líneas 1205/1205 (100 %), ramas 1285/1329 (96,69 %), funciones 220/221 (99,55 %). `lib/form-result.ts`: 45/45 líneas, 45/45 ramas y 8/8 funciones. No es cobertura global de la plataforma.
- 19 grupos SQL de integración: productores reales, errores, permisos, versiones obsoletas, concurrencia, rollback y deduplicación; servicios externos simulados. Bases temporales retiradas.
- Contratos, ocho pruebas de CI, lint, formato y guardia de compilación Webpack/HTTP/server-only. No se repitió Turbopack en esta etapa.

## Evidencia de navegador y límites

Se ejecutó CUA sobre el harness ficticio `tests/action-modal/fixture.mjs`, usando los componentes reales y CSS de Coordinación, en desktop y viewport móvil 390 × 844. Se verificaron errores múltiples, aria-invalid/describedby, IDs únicos, navegación del resumen a sección oculta, foco inicial, teclado, archivo ficticio y texto conservados, fallos generales/excepciones/respuestas inválidas sin cierre ni nueva confirmación, guardado explícito que cierra, apertura controlada, RegistryModal y RegistryForm. Evidencia: [registro](../tests/action-modal/browser-results.json) y [captura móvil](../tests/action-modal/evidence/mobile-errors.png).

El harness no es una prueba CI autónoma ni reproduce la autorización/SQL: esos aspectos se prueban por separado. No certifica lectores de pantalla reales, dispositivos físicos, las seis pantallas completas ni regreso/desplazamiento de listas reales. La navegación exitosa a un destino autorizado de Coordinación no se verificó con CUA en este harness; quedan las pruebas existentes de contexto y esa comprobación visual pendiente. Los criterios de URL permanecieron durante los fallos. No se presenta el intento con un destino de fixture no autorizado como evidencia de navegación correcta.

El harness se instala únicamente en copia temporal, sin dotenv, con base imposible en loopback puerto 1 y bloqueo de red. Next dev intenta consultar metadatos npm aun sin telemetría: se bloquearon los primeros intentos; no llegaron a red. El preload final simula HTTP 503 exclusivamente para las dos URLs exactas de dist-tags/advisories de Next; cualquier otro acceso sigue bloqueado y hace fallar el harness. No equivale a una auditoría de vulnerabilidades. La prueba CI del preload verifica ese aislamiento. Se detuvo el servidor y se retiró su copia temporal.

## Reutilización

Los comandos que guardan deben devolver FormResult tipado, con errores independientes conjuntos, y mantener generales permisos/conexión/concurrencia. Los wrappers no reparan un productor ambiguo mediante interpretación de texto. Usar componentes de feedback existentes y devolver saved solo tras commit confirmado. Para ampliar esta familia, agregar pruebas de tipo, frontera y consumidor antes de retirar compatibilidad. E6 queda parcialmente resuelta (C02); C09/C10 y auditoría E7 no se dan por completadas.
