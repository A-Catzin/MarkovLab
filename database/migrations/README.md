# Migraciones

Esquema de la base y sus cambios versionados. Se aplican en orden y **nunca se editan una vez aplicadas**: cada cambio nuevo va en un archivo nuevo.

| Archivo | Contenido | Aplicada en Supabase |
|---|---|---|
| [`esquema.sql`](./esquema.sql) | Esquema base (0001): `usuarios`, `activos`, `precios_historicos`, `sincronizaciones`, `lista_seguimiento`, `carteras`, `posiciones_cartera` y `simulaciones`, con sus tipos, restricciones, índices, triggers y RLS. | Sí |
| [`0002_cierre_ajustado.sql`](./0002_cierre_ajustado.sql) | Columna opcional `cierre_ajustado` en `precios_historicos` (el `Adj Close` de los CSV), con su CHECK. | **Pendiente** |

## Cómo se verificó que `esquema.sql` es igual a la base

El 2026-11-04 se leyó el catálogo de la base de Supabase y se reescribió `esquema.sql` a partir de él. Después se aplicó el archivo en un PostgreSQL 15 limpio y se comparó, con la misma consulta en ambos lados, una huella (`md5`) de las columnas, restricciones, índices, triggers, enums y RLS. Las seis huellas coincidieron.

Para repetir la comprobación después de un cambio, la consulta de huellas está en [`../docs/README.md`](../docs/README.md#comprobar-que-el-repositorio-y-la-base-coinciden).

## Cómo aplicar una migración nueva

1. Crear el archivo con el siguiente número, por ejemplo `0002_cierre_ajustado.sql`, dentro de una transacción (`BEGIN; … COMMIT;`).
2. Probarlo en un PostgreSQL local con Docker, sobre `esquema.sql` y las migraciones anteriores, y correr las pruebas de integración del backend (ver [`backend/test/README.md`](../../backend/test/README.md)).
3. Aplicarlo en Supabase (SQL Editor o MCP de Supabase) y marcarlo como aplicado en la tabla de arriba.

## Límites

Este directorio no implementa reglas de negocio: las validaciones de varias filas (por ejemplo, que los pesos de una cartera sumen 100 %) viven en el backend Julia.
