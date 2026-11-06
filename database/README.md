# Base de datos

PostgreSQL administrado por Supabase. Los nombres de tablas, columnas y tipos están **en español**. Solo la API Julia se conecta a la base (SRS 6.5): el frontend nunca habla directo con la base de datos ni con Supabase.

## Navegación

- [`migrations/`](./migrations/README.md): el esquema y sus cambios versionados. `esquema.sql` es idéntico a la base en Supabase.
- [`docs/`](./docs/README.md): el modelo de datos, tabla por tabla, y qué parte del backend usa cada una.
- [`seeds/`](./seeds/README.md): datos de ejemplo reproducibles, cuando se definan.
- [`SRS.md`](../documentacion/contexto/SRS.md): requisitos y arquitectura del proyecto.

## Estado

| Tabla | La usa el backend | Para qué |
|---|---|---|
| `usuarios` | Sí: inicio de sesión con Google y roles | Ver [AUTENTICACION.md](../documentacion/tecnica/AUTENTICACION.md) y [ROLES.md](../documentacion/tecnica/ROLES.md). |
| `activos`, `precios_historicos`, `sincronizaciones` | Sí: carga de precios desde CSV (origen `csv`) y desde Apify (origen `api`), y páginas de admin | Ver [IMPORTACION_CSV.md](../documentacion/tecnica/IMPORTACION_CSV.md#cargar-un-csv-a-la-base) y [PRECIOS_API.md](../documentacion/tecnica/PRECIOS_API.md). |
| `carteras`, `posiciones_cartera` | Sí: "Mis carteras" | Ver [CARTERAS.md](../documentacion/tecnica/CARTERAS.md). |
| `simulaciones` | Todavía no | Guardar simulaciones (RF-47). |
| `lista_seguimiento` | Todavía no | Lista de seguimiento (RF-08). |

## Reglas

- **Ningún cambio de esquema se hace a mano en Supabase sin su migración en este repositorio.** Si la base y `esquema.sql` dejan de coincidir, el código y las pruebas se escriben contra algo que no existe.
- Las credenciales (`DATABASE_URL`) nunca se guardan en el repositorio; van en `backend/.env`, que está en `.gitignore`.
- Todas las tablas tienen RLS activado y sin políticas. El backend entra con el usuario dueño de las tablas.
