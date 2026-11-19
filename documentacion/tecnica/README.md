# Documentación técnica

Esta categoría reúne la arquitectura, la estructura del proyecto, las conexiones entre componentes y las decisiones técnicas:

- [`ARCHITECTURE.md`](ARCHITECTURE.md): estructura de capas y distinción entre lo implementado y lo previsto.
- [`METRICAS_DOMINIO.md`](METRICAS_DOMINIO.md): fórmulas y funciones financieras implementadas en el dominio.
- [`CARTERAS_DOMINIO.md`](CARTERAS_DOMINIO.md): pesos, covarianza, rendimiento y riesgo de cartera.
- [`SIMULACION_RIESGO.md`](SIMULACION_RIESGO.md): simulación Monte Carlo (`normal-rebalanced-v1`), VaR y CVaR.
- [`IMPORTACION_CSV.md`](IMPORTACION_CSV.md): formato y reglas de carga de precios históricos desde CSV.
- [`PRECIOS_API.md`](PRECIOS_API.md): descarga de precios y divisas desde Apify (Yahoo Finance).
- [`API.md`](API.md): endpoints HTTP/JSON que expone el backend Julia.
- [`AUTENTICACION.md`](AUTENTICACION.md): inicio de sesión con Google, sesión JWT y protección de rutas internas.
- [`ROLES.md`](ROLES.md): páginas de usuario (`/app`) y administración (`/admin`).
- [`CARTERAS.md`](CARTERAS.md): carteras guardadas, historial de valor, conversión de moneda y simulaciones persistidas.
- [`LANDING.md`](LANDING.md): diseño visual, tokens CSS y simulador de la página de inicio.
- [`DESPLIEGUE.md`](DESPLIEGUE.md): publicación en Vercel, Railway y Supabase, precompilación y pruebas con Docker.

Para el alcance funcional y los actores, consulte [Contexto](../contexto/README.md).
