FROM julia:1.12.7

WORKDIR /app
COPY Project.toml Manifest.toml ./
COPY src/ ./src/
RUN julia --project=. -e 'using Pkg; Pkg.instantiate(); Pkg.precompile()'
COPY scripts/ ./scripts/

ENV HOST=0.0.0.0
CMD ["julia", "--project=.", "scripts/serve.jl"]
