# Scripts

Responsabilidad: reunir tareas locales reproducibles de desarrollo del backend.

Contenido permitido: scripts explícitos y documentados para tareas no destructivas. Límite: no implementar reglas de negocio, almacenar secretos ni ejecutar migraciones implícitas.

## Contenido actual

- `serve.jl`: inicia la API HTTP con la configuración de [`config/README.md`](../config/README.md).

```bash
julia --project=backend backend/scripts/serve.jl
```

Las pruebas se ejecutan directamente con Julia según [`backend/README.md`](../README.md).
