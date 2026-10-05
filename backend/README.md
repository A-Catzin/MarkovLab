# Backend Julia

Este directorio contiene la base comprobable del paquete `MarkovLabBackend`; aún no es un servidor. La organización y las conexiones previstas están en [`ARCHITECTURE.md`](../documentacion/tecnica/ARCHITECTURE.md).

## Inicio rápido

Desde la raíz del repositorio, con Julia instalado:

```bash
julia --project=backend -e 'using MarkovLabBackend'
julia --project=backend backend/test/runtests.jl
```

`Project.toml` define nombre, UUID y versión sin dependencias externas. `src/` contiene el módulo y sus capas futuras; `test/` comprueba la carga; `config/` y `scripts/` reservan límites para configuración y automatización. Consulte cada README local antes de incorporar archivos.

**Fuera de alcance actual:** servidor HTTP, base de datos, datos financieros, despliegue y secretos. No introduzca credenciales en el repositorio.
