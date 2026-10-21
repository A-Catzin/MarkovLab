# Starts the MarkovLab HTTP API.
#
# Usage from the repository root:
#   julia --project=backend backend/scripts/serve.jl
#
# Configuration comes from environment variables (see backend/config/README.md):
# HOST, PORT and ALLOWED_ORIGINS.

using MarkovLabBackend

MarkovLabBackend.Api.start()
