# Inicia la API HTTP de MarkovLab.
#
# Uso desde la raíz del repositorio:
#   julia --project=backend backend/scripts/serve.jl
#
# La configuración se toma de variables de entorno (ver backend/config/README.md):
# HOST, PORT y ALLOWED_ORIGINS.

using MarkovLabBackend

MarkovLabBackend.Api.start()
