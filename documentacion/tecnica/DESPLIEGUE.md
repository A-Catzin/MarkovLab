# Desplegar MarkovLab en Vercel y Railway

El frontend Next.js corre en Vercel, la API Julia en Railway y PostgreSQL en Supabase. Antes de publicar, sube los cambios deseados a una rama del repositorio y revisa que no incluya secretos. Este procedimiento no crea recursos ni despliega automáticamente.

## 1. Preparar PostgreSQL

Usa una base de Supabase accesible desde Railway y comprueba qué migraciones ya tiene aplicadas. En una base nueva aplica, en orden, `database/migrations/esquema.sql`, `0002_cierre_ajustado.sql` y `0003_roles.sql`. **No vuelvas a aplicar el esquema a una base existente** sin revisar su estado. Consulta `database/migrations/README.md` y haz respaldo antes de modificar datos existentes.

Guarda la cadena de conexión de PostgreSQL como `DATABASE_URL` en Railway. Según `AUTENTICACION.md`, el usuario conectado debe poder acceder a las tablas protegidas por RLS. Usa TLS y verifica que el tipo de conexión de Supabase sea compatible con la red de Railway; la dirección directa puede requerir IPv6, mientras que el pooler ofrece otra opción.

## 2. Desplegar la API en Railway

1. Crea un proyecto y un servicio desde el repositorio. Selecciona la rama y configura **Root Directory** como `/backend`.
2. Railway debe detectar `backend/Dockerfile`. El contenedor instala las dependencias y arranca `scripts/serve.jl`.
3. Agrega estas variables al servicio:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Cadena PostgreSQL de Supabase; secreta. |
   | `INTERNAL_API_KEY` | Clave secreta compartida con Vercel, de al menos 32 caracteres. Genera una con `openssl rand -hex 32`. |
   | `ALLOWED_ORIGINS` | URL HTTPS exacta del frontend, por ejemplo `https://tu-proyecto.vercel.app`, sin barra final. Actualízala una vez conocida. |

   Railway asigna `PORT`; el backend escucha en `0.0.0.0`. No copies archivos `.env` a la imagen ni al repositorio.
4. Genera un dominio público HTTPS para el servicio y comprueba `https://TU-BACKEND/health`. Debe responder con `status: ok`. **Este endpoint solo confirma que el servidor responde; no comprueba la base de datos ni el login.** Revisa también los logs de inicio y las funciones de la aplicación.

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

Sin `DATABASE_URL` ni `INTERNAL_API_KEY`, la prueba solo comprueba el arranque; las rutas que dependen de la base o de la clave no estarán disponibles. Para una prueba completa, proporciona las variables de forma segura y usa una base de pruebas.
