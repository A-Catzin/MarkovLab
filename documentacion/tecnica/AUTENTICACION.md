# Autenticación con Google

MarkovLab inicia sesión con Google. **Auth.js** (`next-auth` 4.24) maneja el OAuth en el servidor de Next.js, y el **backend Julia** guarda al usuario en PostgreSQL. El navegador nunca habla con la base de datos ni con el backend para autenticarse (SRS 6.5).

## Flujo

```text
Navegador            Next.js (Auth.js)                  Google            Julia                     PostgreSQL
   │ "Continuar con     │                                  │                 │                          │
   │  Google" ─────────▶│ redirige con state + PKCE ──────▶│                 │                          │
   │                    │◀──── /api/auth/callback/google ──│                 │                          │
   │                    │ verifica el token de identidad   │                 │                          │
   │                    │ y que el correo esté verificado  │                 │                          │
   │                    │ POST /api/internal/users/google ─┼────────────────▶│ upsert por google_sub ──▶│ usuarios 
   │                    │   (X-Internal-Key)               │                 │◀── id, email, nombre ────│
   │                    │◀─────────────────────────────────┼──── 200 {id} ───│                          │
   │◀── cookie de sesión cifrada (JWT con el id de usuarios)  ─ redirige a /app                          │
```

1. En `/login`, el botón llama a `signIn("google")`. Auth.js redirige a Google con `state` y PKCE, que protegen contra CSRF y contra el robo del código.
2. Google vuelve a `/api/auth/callback/google`. Auth.js cambia el código por los tokens y valida el token de identidad.
3. El callback `signIn` (`frontend/lib/auth.ts`) exige `email_verified` y llama al backend. Si el backend no responde, responde con error o tarda más de 5 s, **no se abre sesión** y `/login` muestra el error.
4. El backend guarda o actualiza al usuario por `google_sub` y devuelve su `id`.
5. Auth.js guarda ese `id` en una cookie de sesión cifrada (JWT, 30 días por defecto). Las páginas lo leen con `getSession()`.

## Rutas y protección

| Ruta | Comportamiento |
|---|---|
| `/login` | Con sesión, redirige a `/app`. Con `?error=...`, muestra un mensaje en español. |
| `/app` | Sin sesión, redirige a `/login`. Muestra el nombre y el correo, y el botón "Salir". |
| `/api/auth/*` | Rutas de Auth.js: `signin`, `callback/google`, `session`, `csrf`, `signout`, `providers`. |

"Salir" llama a `signOut()`, que borra la cookie y vuelve a la portada.

## Endpoint interno del backend

`POST /api/internal/users/google`. Solo lo llama el servidor de Next.js; está documentado en [API.md](API.md#post-apiinternalusersgoogle).

- Exige el encabezado `X-Internal-Key`, igual a `INTERNAL_API_KEY`, y lo compara en tiempo constante.
- La clave se revisa **antes** de leer el cuerpo.
- Si falta la clave o la base, responde 503 y el resto del backend sigue funcionando.

## Datos guardados

Tabla `usuarios` (esquema con nombres en español): `id`, `correo`, `nombre_visible`, `google_sub`, `creado_en` y `actualizado_en`. El backend envía el `id` y las fechas explícitamente, así que no depende de los valores por defecto ni de triggers de la tabla. La API mantiene los nombres en inglés (`email`, `display_name`).

- El usuario se identifica por `google_sub`, que Google mantiene aunque cambie el correo.
- En cada inicio de sesión se actualizan el correo y el nombre.
- Si la tabla tiene un índice único sobre el correo y este ya pertenece a otra cuenta de Google, el backend responde 409 (`email_conflict`) y no se abre sesión.
- No se guardan tokens de Google ni contraseñas.

## Variables de entorno

| Dónde | Variable | Para qué |
|---|---|---|
| Frontend | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente OAuth de Google Cloud. |
| Frontend | `NEXTAUTH_SECRET` | Cifra la cookie de sesión. Se genera con `openssl rand -base64 32`. |
| Frontend | `NEXTAUTH_URL` | URL pública del frontend (`http://localhost:3000` en desarrollo). |
| Frontend | `BACKEND_URL` | URL del backend Julia (`http://localhost:8080`). |
| Ambos | `INTERNAL_API_KEY` | Clave compartida entre Next y Julia; **la misma** en los dos y de al menos 32 caracteres. Se genera con `openssl rand -hex 32`. |
| Backend | `DATABASE_URL` | Cadena de conexión de PostgreSQL (Supabase). |

Los archivos reales (`frontend/.env.local` y `backend/.env`) están en `.gitignore` y nunca se suben. Plantillas:

```bash
# frontend/.env.local
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080
INTERNAL_API_KEY=         # openssl rand -hex 32, el mismo valor que en el backend

# backend/.env (Julia no lo lee solo: set -a; source backend/.env; set +a)
DATABASE_URL=             # usuario dueño de las tablas, por RLS sin políticas
INTERNAL_API_KEY=
ALLOWED_ORIGINS=http://localhost:3000
```

En Google Cloud, el cliente OAuth necesita la URI de redirección `http://localhost:3000/api/auth/callback/google`, y la de producción cuando se despliegue.

**Rol de la base:** las tablas tienen RLS activado y sin políticas, así que el backend debe conectarse con el usuario dueño de las tablas (`postgres` en Supabase). Los roles públicos (`anon`, `authenticated`) no ven nada.

## Pruebas

- `backend/test/services/users_tests.jl`: validación del perfil, alta, actualización por `google_sub` y conflicto de correo.
- `backend/test/api/users_api_tests.jl`: 503 sin configuración, 401 sin clave o con clave incorrecta (antes de leer el cuerpo), alta y actualización, 400 y 409.
- `backend/test/infrastructure/postgres_users_tests.jl`: integración con PostgreSQL real. Corre solo con `TEST_DATABASE_URL` y revierte todo al final.

```bash
TEST_DATABASE_URL="postgresql://..." julia --project=backend backend/test/runtests.jl
```

El flujo con Google solo se puede probar en un navegador con credenciales reales.
