# Desplegar MarkovLab en Vercel y Railway

Las variables de cada servicio tienen plantilla en `despliegue/railway.env.plantilla` y `despliegue/vercel.env.plantilla`: cópialas como `railway.env` y `vercel.env` en la misma carpeta (git las ignora), llénalas y pégalas en cada panel.

El frontend Next.js corre en Vercel, la API Julia en Railway y PostgreSQL en Supabase. Antes de publicar, sube los cambios deseados a una rama del repositorio y revisa que no incluya secretos. Este procedimiento no crea recursos ni despliega automáticamente.

## 1. Preparar PostgreSQL

Usa una base de Supabase accesible desde Railway y comprueba qué migraciones ya tiene aplicadas. En una base nueva aplica, en orden, `database/migrations/esquema.sql`, `0002_cierre_ajustado.sql`, `0003_roles.sql` y `0004_tipos_cambio.sql`, y después carga los tipos de cambio (`sync_prices.jl --divisas --desde 2000-01-01`, ver `PRECIOS_API.md`). La base de Supabase actual ya tiene las cuatro (2026-11-18). **No vuelvas a aplicar el esquema a una base existente** sin revisar su estado. Consulta `database/migrations/README.md` y haz respaldo antes de modificar datos existentes.

Guarda la cadena de conexión de PostgreSQL como `DATABASE_URL` en Railway. Según `AUTENTICACION.md`, el usuario conectado debe poder acceder a las tablas protegidas por RLS. Usa TLS y verifica que el tipo de conexión de Supabase sea compatible con la red de Railway; la dirección directa puede requerir IPv6, mientras que el pooler ofrece otra opción.

## 2. Desplegar la API en Railway

1. Crea un proyecto y un servicio desde el repositorio. Selecciona la rama y configura **Root Directory** como `/backend`.
2. Railway debe detectar `backend/Dockerfile`. El contenedor instala las dependencias, precompila el paquete y arranca `scripts/serve.jl`. La imagen pesa unos 2 GB y se construyó en 1 min 38 s en local (2026-11-19).
   - **Procesador:** el Dockerfile fija `JULIA_CPU_TARGET` para que el código precompilado sirva en cualquier procesador x86-64. Railway construye la imagen en una máquina y la corre en otra; sin esto, Julia descartaba el caché y recompilaba todo al arrancar (`Precompiling packages...` en los Deploy Logs), el servidor no llegaba a escuchar y Railway respondía **502 en milisegundos** (2026-11-19). Si vuelve a aparecer `Precompiling packages...` al arrancar, el caché no se está usando.
   - **Arranque en frío:** al precompilar, `src/precompile.jl` recorre una vez las rutas principales con datos en memoria, y el código compilado queda en la imagen. Al arrancar, después de conectarse a la base, el servidor corre una vez las lecturas de PostgreSQL (`warm_database`). Medido en local con Supabase, la primera petición tras arrancar bajó de 2.7 s a 1.2 s en la historia y de 2.4 s a 1.3 s al simular; el frontend corta a los 10 s.
3. Agrega estas variables al servicio:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Cadena PostgreSQL de Supabase; secreta. |
   | `INTERNAL_API_KEY` | Clave secreta compartida con Vercel, de al menos 32 caracteres. Genera una con `openssl rand -hex 32`. |
   | `ALLOWED_ORIGINS` | URL HTTPS exacta del frontend, por ejemplo `https://tu-proyecto.vercel.app`, sin barra final. Actualízala una vez conocida. |

   Railway asigna `PORT`; el backend escucha en `0.0.0.0`. No copies archivos `.env` a la imagen ni al repositorio.
4. Genera un dominio público HTTPS para el servicio y comprueba `https://TU-BACKEND/health`. Debe responder con `status: ok`. En los logs deben aparecer `Database connection ready` y `Database routes warmed up` unos segundos después del arranque; si en su lugar aparece `Could not connect to the database at startup`, revisa `DATABASE_URL`. **Este endpoint solo confirma que el servidor responde; no comprueba la base de datos ni el login.** Revisa también los logs de inicio y las funciones de la aplicación.

## 3. Desplegar el frontend en Vercel

1. Importa el mismo repositorio y elige `frontend` como **Root Directory**. Vercel debe detectar Next.js; el build es `npm run build`.
2. Configura las variables de producción antes de desplegar:

   | Variable | Valor |
   |---|---|
   | `GOOGLE_CLIENT_ID` | ID del cliente OAuth de Google. |
   | `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth. |
   | `NEXTAUTH_SECRET` | Secreto de sesión; genera uno con `openssl rand -base64 32`. |
   | `NEXTAUTH_URL` | URL pública HTTPS del frontend, sin barra final. |
   | `BACKEND_URL` | URL HTTPS pública de Railway, sin barra final. Es de uso en servidor, no `NEXT_PUBLIC`. |
   | `INTERNAL_API_KEY` | Exactamente la misma clave configurada en Railway. |

3. En Google Cloud, agrega a las URI de redirección autorizadas `https://TU-FRONTEND/api/auth/callback/google`. Verifica la configuración de la pantalla de consentimiento y, si está en modo de prueba, los usuarios autorizados.
4. Despliega o vuelve a desplegar tras actualizar las variables. Ajusta `ALLOWED_ORIGINS` en Railway con la URL final de Vercel y vuelve a desplegar el backend si es necesario.

Las URLs de preview pueden diferir de la URL de producción: configúralas explícitamente si vas a probar OAuth y CORS en esos entornos. Usa secretos y, preferiblemente, una base separados para pruebas.

## 4. Comprobaciones antes de compartir

- [ ] `cd frontend && npm run typecheck && npm run build` pasa.
- [ ] `julia --project=backend -e 'using Pkg; Pkg.test()'` pasa. Las pruebas de PostgreSQL necesitan `TEST_DATABASE_URL` apuntando a una **base de pruebas**, nunca a producción.
- [ ] `/health` responde; los logs no muestran errores de arranque o conexión.
- [ ] Se puede iniciar y cerrar sesión con Google y persiste el usuario.
- [ ] Crear y consultar una cartera y una simulación funciona con datos de prueba.
- [ ] Las rutas y funciones públicas se han revisado antes de exponer el backend. CORS no es autenticación ni impide llamadas directas a la API.
- [ ] Hay respaldos, controles de acceso y presupuesto de consumo para Vercel, Railway, Supabase y Google.

La actualización de precios desde Apify es una tarea separada; desplegar la API no programa su ejecución. Consulta `PRECIOS_API.md` para configurar la sincronización.

## Probar el contenedor localmente

```bash
docker build -t markovlab-backend:local backend
docker run --rm -p 8080:8080 markovlab-backend:local
# En otra terminal:
curl http://localhost:8080/health
```

Prueba completa del 2026-11-19, como en Railway (`PORT` asignado, base de pruebas local con las cuatro migraciones, clave generada con `openssl rand -hex 32`):
- `/health` respondió 8 s después de arrancar el contenedor.
- Las rutas internas responden 401 sin clave y 403 con un usuario inexistente.
- CORS deja pasar el origen de `ALLOWED_ORIGINS`.
- Los logs muestran `Database connection ready` y `Database routes warmed up`.

Sin `DATABASE_URL` ni `INTERNAL_API_KEY`, la prueba solo comprueba el arranque; las rutas que dependen de la base o de la clave no estarán disponibles. Para una prueba completa, proporciona las variables de forma segura y usa una base de pruebas.
