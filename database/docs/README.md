# Modelo de datos

Tablas de la base, con nombres en español. La definición exacta está en [`../migrations/esquema.sql`](../migrations/esquema.sql).

```text
usuarios ─┬─< carteras ─┬─< posiciones_cartera >── activos ─┬─< precios_historicos
          │             └─< simulaciones (cartera_id opcional)  ├─< sincronizaciones
          ├─< simulaciones                                       └─< lista_seguimiento
          └─< lista_seguimiento
```

| Tabla | Clave | Qué guarda | Reglas principales |
|---|---|---|---|
| `usuarios` | `id` (uuid) | Usuarios que entraron con Google y su rol (`rol`, migración 0003: `usuario` o `admin`). | `google_sub` único; correo único sin distinguir mayúsculas. |
| `activos` | `id` (identity) | Activos: símbolo, nombre, mercado, categoría y moneda. | Único por `(mercado, simbolo)`; símbolo en mayúsculas; moneda ISO de 3 letras. El backend guarda el mercado en mayúsculas. |
| `precios_historicos` | `(activo_id, fecha_operacion, origen)` | Barras OHLCV y, opcional, el cierre ajustado (`cierre_ajustado`, migración 0002, aplicada). | Precios positivos y finitos; máximo ≥ apertura, mínimo y cierre; mínimo ≤ apertura y cierre. |
| `sincronizaciones` | `id` (identity) | Una fila por carga de datos. | Estado `en_curso`, `exitosa`, `parcial` o `fallida`; con fecha de fin si y solo si terminó. |
| `lista_seguimiento` | `(usuario_id, activo_id)` | Activos que sigue cada usuario. | |
| `carteras` | `id` (uuid) | Carteras de cada usuario. | Capital positivo; estado `borrador`, `activa` o `archivada`; `derivada_de_id` para versiones. |
| `posiciones_cartera` | `(cartera_id, activo_id)` | Peso de cada activo en una cartera. | Peso entre 0 y 1; la suma = 1 la valida el backend. |
| `simulaciones` | `id` (uuid) | Corridas Monte Carlo guardadas. | Mismos límites que el backend (1 a 100,000 escenarios, horizonte de 1 a 2,520). |

**Tipos enumerados:** `origen_precio` (`csv`, `api`, `manual`), `estado_cartera`, `estado_sincronizacion` y `rol_usuario` (`usuario`, `admin`; migración 0003).

**Fechas:** `creado_en` y `actualizado_en` tienen `now()` por defecto, y en `usuarios`, `activos` y `carteras` el trigger `establecer_actualizado_en` actualiza `actualizado_en` en cada `UPDATE`.

## Qué parte del backend usa cada tabla

| Tabla | Código |
|---|---|
| `usuarios` | `backend/src/infrastructure/postgres_users.jl` |
| `activos`, `precios_historicos`, `sincronizaciones` | `backend/src/infrastructure/postgres_prices.jl` |
| `carteras`, `posiciones_cartera` | `backend/src/infrastructure/postgres_portfolios.jl` |

Las dos comparten la conexión de `backend/src/infrastructure/postgres.jl` (candado, reconexión y transacciones).

## Comprobar que el repositorio y la base coinciden

Esta consulta da una huella por categoría. Si se corre en Supabase y en un PostgreSQL local con `esquema.sql` y las migraciones aplicadas, las huellas deben coincidir:

```sql
select kind, md5(string_agg(x, '|' order by x)) as huella, count(*) as n from (
  select 'columnas' as kind, table_name||'.'||column_name||':'||udt_name||':'||coalesce(character_maximum_length::text,'')||':'||coalesce(numeric_precision::text,'')||','||coalesce(numeric_scale::text,'')||':'||is_nullable||':'||coalesce(column_default,'')||':'||is_identity||':'||coalesce(identity_generation,'') as x
    from information_schema.columns where table_schema='public'
  union all select 'restricciones', conrelid::regclass::text||'.'||conname||':'||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace
  union all select 'indices', indexname||':'||indexdef from pg_indexes where schemaname='public'
  union all select 'triggers', trigger_name||':'||event_object_table||':'||action_timing||' '||event_manipulation||' '||action_statement from information_schema.triggers where trigger_schema='public'
  union all select 'enums', t.typname||':'||e.enumsortorder||':'||e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typnamespace='public'::regnamespace
  union all select 'rls', relname||':'||relrowsecurity||':'||relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'
) s group by kind order by kind;
```
