# Roles y páginas

MarkovLab tiene dos roles. El rol se guarda en la base (`usuarios.rol`, migración `0003`) y decide qué páginas ve cada quien.

| Rol | En la base | Páginas |
|---|---|---|
| **Usuario** | `usuario` (por defecto: todo el que entra con Google) | `/app` (inicio), `/app/carteras`, `/app/simulador` |
| **Admin** | `admin` | Todo lo de usuario, más `/admin` (resumen), `/admin/activos`, `/admin/importaciones` y `/admin/usuarios` |

## Quién es admin

- El **primer admin** se asigna una sola vez desde el SQL Editor de Supabase:
  ```sql
  UPDATE usuarios SET rol = 'admin' WHERE lower(correo) = lower('correo@ejemplo.com');
  ```
- Después, cualquier admin cambia roles desde **/admin/usuarios**.
- **Nunca se queda el sistema sin admins:** el backend rechaza quitar el rol al último admin (409 `last_admin`). La comprobación bloquea las filas de los admins (`FOR UPDATE`), así que dos cambios simultáneos tampoco pueden dejarlo en cero.
- **Nadie actúa con un rol recién perdido:** dentro de esa misma operación se verifica que quien hace el cambio siga siendo admin. Si otro admin le quitó el rol un instante antes, recibe 403.

## Cómo se protege

La protección tiene dos capas, y la segunda no confía en la primera:

1. **Next.js (navegación).** Los layouts de `/app` y `/admin` revisan la sesión en el servidor (`frontend/lib/guards.ts`):

   | Quién | `/app/*` | `/admin/*` |
   |---|---|---|
   | Sin sesión | → `/login` | → `/login` |
   | Usuario | ✓ | → `/app` |
   | Admin | ✓ | ✓ |

   El rol viaja en la cookie de sesión. Pasado el primer minuto desde el inicio de sesión, **se vuelve a leer de la base en cada carga de página** (una sola consulta por solicitud), así que un ascenso o una baja se reflejan sin volver a entrar. Una sesión de un usuario que ya no existe cuenta como cerrada.

2. **Backend (datos).** Cada ruta de admin exige, además de la clave interna, el encabezado `X-Actor-Id` con el id de quien navega, y verifica **en la base, en ese momento,** que sea admin. Si no lo es, responde 403 y la página muestra "Tu cuenta ya no tiene permisos de admin" sin ningún dato.

Así, aunque una cookie diga "admin" (por ejemplo, un token de hace segundos de alguien a quien le quitaron el rol), los datos no salen.

## Páginas

| Página | Qué muestra |
|---|---|
| `/app` | Saludo y módulos: Simulador (disponible), Mis carteras (en construcción), Optimización y Backtesting (próximamente). |
| `/app/carteras` | Las carteras del usuario, y `/app/carteras/nueva` y `/app/carteras/{id}` para crearlas, verlas y borrarlas (ver [CARTERAS.md](CARTERAS.md)). |
| `/app/simulador` | El simulador de la landing, con la cartera de ejemplo. |
| `/admin` | Cantidad de usuarios y admins, activos, filas de precios y la última importación. |
| `/admin/activos` | Catálogo: símbolo, nombre, mercado, categoría, moneda, cantidad de precios, periodo y última carga. |
| `/admin/importaciones` | Subida de CSV y las últimas 100 importaciones, con estado, filas guardadas y fallidas, y el detalle del error. |
| `/admin/usuarios` | Usuarios con su rol y un botón para cambiarlo. |

Todas comparten el marco `components/app/AppShell.tsx`: logo, enlaces del laboratorio y, solo para admins, el grupo "Admin". En el teléfono, cada grupo de enlaces es una fila que se desliza de lado.

## Código

| Capa | Archivos |
|---|---|
| Base | `database/migrations/0003_roles.sql` (tipo `rol_usuario` y columna `usuarios.rol`). |
| Backend: dominio | `src/domain/users.jl`: `AppUser.role`, `USER_ROLES`, `parse_role`, `ForbiddenError`, `LastAdminError`, y el puerto `find_user`, `list_users`, `set_user_role`. `src/domain/assets.jl`: `list_assets` y `list_imports`. |
| Backend: servicios | `src/services/admin.jl`: `require_admin`, `change_user_role` y `admin_summary`. |
| Backend: adaptadores | `src/infrastructure/postgres_users.jl` y `postgres_prices.jl`, con sus versiones en memoria. |
| Backend: API | Rutas internas en `src/api/routes.jl` (ver [API.md](API.md#rutas-internas-de-admin)). |
| Frontend | `lib/backend.ts` (cliente con `X-Internal-Key` y `X-Actor-Id`), `lib/auth.ts` (rol en la sesión), `lib/guards.ts`, `lib/admin.ts`, `components/app/`, `app/app/` y `app/admin/`. |

## Pruebas

- `backend/test/services/roles_tests.jl`: rol por defecto, volver a entrar no cambia el rol, solo un admin cambia roles, regla del último admin y lecturas del catálogo.
- `backend/test/api/admin_api_tests.jl`: cada ruta de admin sin clave (401), sin actor, con un usuario normal o con un id inválido (403), con un admin (200), y el cambio de rol (409, 400 y 404).
- `backend/test/infrastructure/postgres_*_tests.jl`: lo mismo contra PostgreSQL real, con `esquema.sql` + `0002` + `0003`.
- De punta a punta (manual, 2026-11-04): la matriz de redirecciones de arriba con sesiones de prueba, un token "admin" de un usuario normal (sin datos y con el mensaje de permisos) y el cambio de rol desde la página (bloqueo del último admin y ascenso).
