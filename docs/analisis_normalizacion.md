# Estado de normalización de la base

Revisión del proyecto Revisador, 6 de noviembre de 2026. La jerarquía académica utiliza tablas separadas y claves foráneas. Las cuentas de la aplicación solo consultan los datos que permiten sus políticas RLS; las operaciones de escritura pasan por funciones que comprueban la propiedad o el token de recepción.

## Dependencias revisadas

- Cada detalle de pregunta referencia un criterio versionado. Su número y máximo se consultan desde ese criterio; ya no se guardan como copias en el detalle.
- La nota final se calcula sumando las preguntas. Ya no se guarda otra copia en el examen. La biblioteca conserva el campo mediante una función calculada que respeta RLS.
- La ruta y el número de entrega activa se obtienen de la última versión del historial. Las cargas manuales también tienen una versión inicial; un control diferido exige que todo examen conserve al menos una entrega.

La suma derivada entre tablas no constituía por sí sola prueba de una dependencia transitiva en la misma relación, pero su eliminación evita una fuente de discrepancias. Las claves y dependencias empleadas por las relaciones principales son:

| Relación | Clave y dependencia |
| --- | --- |
| Jerarquía académica | Cada identificador determina los atributos de su nivel y referencia directamente a su padre. El año también es único por propietario. |
| Evaluación | Su identificador determina el curso, título, reglas y estado de esa evaluación. |
| Examen | Su identificador determina la evaluación, la identidad registrada y el estado de revisión. No almacena una nota ni una ruta activa duplicada. |
| Versión de rúbrica | Su identificador determina la evaluación y el estado de la versión. Una evaluación tiene como máximo una versión activa. |
| Criterio versionado | Su identificador, o la combinación de versión y número, determina el máximo y la respuesta esperada. |
| Detalle de pregunta | Su identificador, o la combinación de examen y criterio versionado, determina el puntaje obtenido, respuesta y justificación. |
| Historial de entregas | Su identificador, o la combinación de examen y número de entrega, determina la ruta y los datos de esa versión. |

Estas dependencias describen las reglas implementadas por el sistema. La 3FN depende también de las reglas del dominio: no se presupone, por ejemplo, que un código estudiantil identifique a la misma persona entre instituciones o docentes distintos.

Las versiones de rúbrica creadas desde ahora registran los criterios utilizados. Las versiones iniciales se marcaron como `reconstruida`: sus puntajes coinciden con los detalles existentes, pero no es posible demostrar que la respuesta esperada actual sea la misma que había cuando se calificó. Asimismo, las primeras entregas históricas reconstruidas se identifican como tales; no se inventaron versiones anteriores.

Las funciones calculadas mantienen los campos que necesita la aplicación sin duplicarlos en las tablas. Se probaron recepción, carga manual, reenvíos, recalificación, eliminación, aislamiento de docentes y exportación Excel sobre una base reconstruida y PostgREST aislado.

## Migraciones y permisos

Los nombres de `supabase/migrations` coinciden con las versiones registradas por Supabase. Se comparó el contenido de cada migración con el historial remoto y se reconstruyó una base de pruebas desde cero. La antigua propuesta `20261104150000_validar_precision_resultados.sql` no figuraba como aplicada; se conserva en `docs/migraciones_historicas` porque su validación fue incorporada posteriormente sin reemplazar las correcciones de identidad.

La migración `proteger_permisos_datos` retira de los roles de aplicación `TRUNCATE`, `TRIGGER` y `REFERENCES` sobre las tablas públicas. El historial permite lectura al docente y las funciones de recepción siguen registrando entregas con los privilegios adecuados. Las funciones privilegiadas de recepción y gestión docente se aislaron en esquemas no expuestos, conservando sus comprobaciones de token o propiedad.

El aviso de protección contra contraseñas filtradas sigue activo. Según la [tabla de planes de Supabase](https://supabase.com/pricing), esa función no está incluida en el plan gratuito. No se ha cambiado el plan ni activado un servicio de pago.
