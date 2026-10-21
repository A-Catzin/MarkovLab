# Configuración

Responsabilidad: documentar opciones no sensibles de ejecución del backend.

Contenido permitido: ejemplos de parámetros sin valores privados y sus descripciones. Límite: nunca guardar claves, contraseñas ni archivos de entorno con secretos; los valores sensibles deberán suministrarse fuera del repositorio.

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `HOST` | `0.0.0.0` | Interfaz donde escucha el servidor HTTP. |
| `PORT` | `8080` | Puerto del servidor; Railway lo asigna automáticamente. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Orígenes del frontend permitidos por CORS, separados por comas. `*` permite cualquiera y solo debe usarse en desarrollo. |

Ejemplo para producción (sin secretos):

```bash
ALLOWED_ORIGINS="https://markovlab.vercel.app"
```

`DATABASE_URL`, `MARKET_API_KEY` y `MARKET_API_BASE_URL` (SRS 6.5) se incorporarán con la base de datos y la API de mercado; serán secretos y se configurarán solo en el entorno de despliegue.
