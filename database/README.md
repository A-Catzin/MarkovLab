# Base de datos

PostgreSQL administrado por Supabase. Los nombres de tablas, columnas y tipos están **en español**. Solo la API Julia se conecta a la base (SRS 6.5): el frontend nunca habla directo con la base de datos ni con Supabase.

## Navegación

- [`migrations/`](./migrations/README.md): el esquema base (`esquema.sql`) y las migraciones versionadas (`0002` a `0004`) aplicadas en Supabase.
- [`docs/`](./docs/README.md): el modelo de datos, tabla por tabla, y qué parte del backend usa cada una.
- [`seeds/`](./seeds/README.md): datos de ejemplo reproducibles, cuando se definan.
- [`SRS.md`](../documentacion/contexto/SRS.md): requisitos y arquitectura del proyecto.

## Estado

| Tabla | La usa el backend | Para qué |
|---|---|---|
| `usuarios` | Sí: inicio de sesión con Google y roles | Ver [AUTENTICACION.md](../documentacion/tecnica/AUTENTICACION.md) y [ROLES.md](../documentacion/tecnica/ROLES.md). |
| `activos`, `precios_historicos`, `sincronizaciones` | Sí: carga de precios desde CSV (origen `csv`) y desde Apify (origen `api`), y páginas de admin | Ver [IMPORTACION_CSV.md](../documentacion/tecnica/IMPORTACION_CSV.md#cargar-un-csv-a-la-base) y [PRECIOS_API.md](../documentacion/tecnica/PRECIOS_API.md). |
| `tipos_cambio` | Sí: conversión de moneda en historia y simulaciones de carteras | Migración [`0004_tipos_cambio.sql`](./migrations/0004_tipos_cambio.sql); ver [PRECIOS_API.md](../documentacion/tecnica/PRECIOS_API.md#tipos-de-cambio) y [CARTERAS.md](../documentacion/tecnica/CARTERAS.md#moneda). |
| `carteras`, `posiciones_cartera` | Sí: "Mis carteras" | Ver [CARTERAS.md](../documentacion/tecnica/CARTERAS.md). |
| `simulaciones` | Sí: el panel "Simular" de cada cartera | Ver [CARTERAS.md](../documentacion/tecnica/CARTERAS.md#simular). |
| `lista_seguimiento` | Sí: seguimiento de mercado por usuario | Ver [API.md](../documentacion/tecnica/API.md#seguimiento-de-mercado-rf-08-a-rf-11). |

## Reglas

- **Ningún cambio de esquema se hace a mano en Supabase sin su migración en este repositorio.** Si la base y `esquema.sql` dejan de coincidir, el código y las pruebas se escriben contra algo que no existe.
- Las credenciales (`DATABASE_URL`) nunca se guardan en el repositorio; van en `backend/.env`, que está en `.gitignore`.
- Todas las tablas tienen RLS activado y sin políticas. El backend entra con el usuario dueño de las tablas.
