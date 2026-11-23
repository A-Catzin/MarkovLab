FROM julia:1.12.7

WORKDIR /app

# SCIP loads libformw.so.6 from the operating system during Julia precompilation.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libncursesw6 \
    && rm -rf /var/lib/apt/lists/*

# Código precompilado para cualquier procesador x86-64, no solo para el de la máquina que
# construye la imagen. Railway construye en una máquina y corre en otra: sin esto, Julia
# descarta el caché al arrancar y recompila todo (varios minutos y mucha memoria), y el
# servidor no llega a escuchar (502 en Railway, visto el 2026-11-19). Es el mismo valor que
# usan los binarios oficiales de Julia.
ENV JULIA_CPU_TARGET="generic;sandybridge,-xsaveopt,clone_all;haswell,-rdrnd,base(1)"

COPY Project.toml Manifest.toml ./
COPY src/ ./src/
RUN julia --project=. -e 'using Pkg; Pkg.instantiate(); Pkg.precompile()'
COPY scripts/ ./scripts/

ENV HOST=0.0.0.0
CMD ["julia", "--project=.", "scripts/serve.jl"]
