# Separación de pruebas y medición inicial

Etapa verificada localmente con datos ficticios. No se publicaron cambios, accedió a beta, enviaron correos ni cargaron archivos en proveedores. El [inventario completo](../tests/README.md) clasifica cada script anterior por sus dependencias y detalla comandos y limpieza.

## Resultado

- **62 pruebas unitarias correctas**: 20 de navegación ya existentes y 42 de validaciones/reglas, infraestructura pura y protección del ejecutor.
- **12 grupos de integración** sobre PostgreSQL local desechable y **dos contratos sin DB** (Auth.js y adaptador de correo).
- Los validadores ejecutados son los mismos que usan cliente/servidor. Los hooks de Node solo resuelven imports TypeScript o rechazan infraestructura en unitarias; no reemplazan las reglas.
- Se conservaron consultas y APIs mediante reexportaciones. Solo se extrajeron agrupación/advertencia, cálculo de trayectoria y criterios de búsqueda de sus módulos con dependencias de servidor.

Se detectaron expectativas desactualizadas en `test-outing-editor.mjs` y `test-volunteer-participation.mjs`: buscaban errores individuales en `target`/`error` en lugar de `fieldErrors`. Se actualizaron las aserciones y el fixture de carga autorizada para comprobar el contrato ya implementado, conservando la comprobación de ausencia de cambios parciales. No se modificó el comportamiento de los servicios para hacer pasar esas pruebas.

## Reglas y casos incluidos

- Identificación pública de nueve dígitos y conciliación de identificadores históricos como reglas distintas.
- Fechas reales, año cero, bisiestos, rangos iguales/abiertos/invertidos y coincidencias flexibles inclusivas.
- Transporte, cantidades enteras/cero/límites, motivos y aceptación de gastos; aprobación de fechas fuera de rango.
- Perfil, campos condicionales, pólizas, incidentes, decisiones y selección de roles/unidades.
- Periodos múltiples con identificador estable, fotos por archivo y lote, metadatos/autorización y selección de galería.
- Edición individual directa frente a herencia/personalización, alcance de datos comunes y capacidad mínima por reservas.
- Borrador frente a finalización, vocabularios de labores/gira, asistencia y confirmación requerida.
- Evidencia contradictoria, deduplicación de participaciones y diferencia entre participación histórica/asumida y asistencia acreditada.
- Agrupación transitiva por fechas, advertencia con reloj/ventana explícitos y estados editables.
- Plan histórico con fixture sintético de 17 inscripciones demo: contratos, referencias, responsables fuertes, vínculos probables pendientes y fechas inválidas. Ninguna ficha original se incorpora a la suite.
- Plantilla de correo, escape HTML, enlaces de cancelación y autenticación/resultados del cron con servicio inyectado.
- Guards locales, lexer de migraciones y contratos/almacén/decisiones de navegación existentes.

La integración mantiene la prueba real en PostgreSQL de elegibilidad/póliza, permisos, duplicados, cupos/espera/promoción, edición y cancelación privadas, versiones obsoletas y decisiones simultáneas. También cubre importación CSV por fila/columna, herencia de fotos, borrador sin evidencia de asistencia, conciliación y migraciones/adopción. La suite no usa una implementación falsa del algoritmo de reservas.

## Medición inicial

Motor: `node:test` / V8, Node **v25.2.1**. Fecha de la ejecución: 12 de noviembre de 2026 en Costa Rica. Archivo completo, por módulo, contadores y ramas sin ejecutar: [cobertura-unitaria-inicial.json](cobertura-unitaria-inicial.json).

| Métrica | Resultado del subconjunto declarado |
| --- | --- |
| Líneas | 756 / 756 — **100 %** |
| Ramas | 770 / 798 — **96,49 %** |
| Funciones | 140 / 141 — **99,29 %** |

El denominador es una lista explícita de **25 módulos** en `tests/unit/modules.mjs`: validadores de formulario, reglas extraídas, logística/cambios/fechas, plan histórico, plantilla y cron, guards/lexer y los dos módulos de navegación. Las constantes puras auxiliares no se incluyen como cobertura de lógica. El informe detecta si falta medir un módulo declarado.

**No es cobertura de toda la plataforma.** Quedan fuera acciones de servidor, consultas SQL, outbox real, transacciones, carga/entrega Graph, autenticación institucional real, parser CSV integrado con consultas/versiones, React/DOM, accesibilidad y E2E. Se verifican con integración, contratos, compilación o navegador, según el caso; no se suman a esta métrica.

El 100 % de líneas tampoco significa que se hayan probado todas las condiciones: varios archivos existentes concentran muchas decisiones en una línea y V8 mide bloques/ramas, no todas las combinaciones booleanas ni cobertura MC/DC. La corrección depende de los casos y aserciones, no solo del porcentaje.

### Revisión de huecos

- `registration-mail-template.mjs`: 85,37 % de ramas; faltan algunas variantes de respaldo de datos/fechas y enlaces inválidos. Los estados operativos y las cancelaciones sin enlace sí se comprueban.
- `registration-changes.ts`: 86,67 % de ramas; quedan variantes de representación/respaldo. Los cambios de campos y el transporte legado se prueban.
- `outing-form-validation.ts`: 93,80 % de ramas; quedan combinaciones secundarias de metadatos y alcance. No se declara completa la matriz combinatoria.
- `registration-validation.ts`: 96,97 % de ramas; quedan valores alternativos de respaldo, sin confundirlo con validación de elegibilidad por SQL.
- Navegación: persisten ramas de respaldo y una función no recorrida de almacén; se conserva la medición previa y su alcance limitado.

El JSON/LCOV permite ubicar esos huecos por línea y rama. No se agregaron aserciones que reproduzcan el código únicamente para aumentar porcentajes.

### Umbrales propuestos

Para acordar al incorporar CI, usando este mismo denominador y versión del motor:

1. Subconjunto agregado: **95 % líneas, 90 % ramas y 95 % funciones**; evita una caída grande respecto a la medición inicial sin exigir un 100 % engañoso.
2. Validadores críticos de identificación, fechas, cupos, autorización explícita y finalización: **95/90/95 por módulo**, para que los módulos pequeños no queden ocultos por el agregado.
3. Plantillas y representación de cambios: inicialmente **95 % líneas y 80 % ramas**, acompañados de los casos funcionales obligatorios de cancelación, enlaces y escape. Priorizar esas variantes antes de aumentar el umbral.
4. Para módulos nuevos, incorporar pruebas y denominador en el mismo cambio; no subir el porcentaje excluyendo archivos. Revisar diferencias del motor al cambiar Node.

Son propuestas documentadas, **no gates de CI ya activados**. La automatización de CI, pruebas con lectores reales y una matriz de navegadores/dispositivos permanecen pendientes. La suite CUA de navegación no se presenta como ejecutable autónomo de CI.

## Medición posterior: validación de entradas

La etapa siguiente amplía el inventario a **29 módulos** y **68 pruebas**. Incluye lectura de FormData, parser de fotos, CSV puro y respuestas Graph. Resultado del subconjunto: líneas 100 %, ramas 95,89 %, funciones 99,36 %. La tabla anterior y su JSON se conservan como baseline histórica, no como medición actual. Los cambios de denominador impiden interpretar la diferencia como una regresión global. Ver [alcance y límites de la nueva etapa](validacion-de-entradas.md).

## Medición posterior: autorización

72 unitarias y 30 módulos puros declarados. Cobertura del subconjunto: 100 % líneas, 95,96 % ramas y 99,41 % funciones; `authorization.ts` tiene 100 % líneas, 97,56 % ramas y 100 % funciones. Se conserva la medición histórica; no se declara cobertura global. [Matriz, integración directa, inventario y límites](autorizacion.md).

## Medición posterior: transiciones

80 unitarias y 31 módulos declarados. Resultado del subconjunto: líneas 100 %, ramas 96,39 %, funciones 99,47 %; el módulo puro de transiciones tiene 100 % en esas tres métricas. No representa cobertura global ni todas las combinaciones. [Inventario, atomicidad, integración y límites](transiciones-de-estado.md).
