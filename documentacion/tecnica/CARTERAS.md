# Mis carteras

Cada usuario crea, ve y borra sus propias carteras (RF-27 a RF-31). Una cartera es cómo se reparte un capital entre activos del catálogo: por ejemplo, 60 % en AAPL y 40 % en MSFT.

## Páginas

| Página | Qué hace |
|---|---|
| `/app/carteras` | Lista las carteras del usuario, de la más nueva a la más vieja. Sin carteras, explica qué es una y ofrece crear la primera. |
| `/app/carteras/nueva` | Formulario: nombre, capital, moneda y una fila por activo con su porcentaje. Muestra la suma en vivo y no deja guardar hasta que dé 100 %. "Repartir en partes iguales" divide el 100 % entre las filas. |
| `/app/carteras/{id}` | Detalle: capital, cantidad de activos, estado, barra de composición (RF-31) y tabla con peso y monto de cada activo. Botón "Borrar cartera". |

El formulario solo ofrece activos del catálogo, es decir, los que tienen precios cargados. Si no hay ninguno, lo dice y explica que un admin tiene que cargarlos.

## Reglas

Las valida el backend (`PortfolioDraft`, `backend/src/domain/saved_portfolios.jl`); el formulario solo ayuda.

- **Nombre:** obligatorio, hasta 120 caracteres.
- **Capital:** entre 0.01 (un centavo) y 10¹⁵. Se guarda con 2 decimales, así que nunca queda en 0.00.
- **Moneda:** código ISO de 3 letras (el formulario ofrece MXN, USD y EUR).
- **Activos:** entre 1 y 50, sin repetir, y todos tienen que existir en el catálogo.
- **Pesos:** cada uno entre 0 y 100 %, y en total **100 %** (RF-29). Se guardan como fracción con 8 decimales: 33.33 % se guarda como `0.3333` exacto.
- Una cartera nueva queda en estado `borrador`.

## Seguridad: cada uno ve solo lo suyo

Todas las consultas de carteras filtran por el usuario en la base (`WHERE usuario_id = …`). La cartera de otra persona **no existe** para ti:
- `/app/carteras/{id}` responde 404, y la API también.
- No aparece en tu lista.
- No la puedes borrar.

El usuario sale de la sesión, y el backend verifica en la base que exista (`X-Actor-Id`).

Crear una cartera es **atómico**: si algún activo no existe, no se guarda nada. Borrarla elimina sus posiciones (`ON DELETE CASCADE`). Un activo que está en alguna cartera no se puede borrar del catálogo (`ON DELETE RESTRICT`).

## Código

| Capa | Archivos |
|---|---|
| Dominio | `backend/src/domain/saved_portfolios.jl`: `PositionDraft`, `PortfolioDraft`, `SavedPosition`, `SavedPortfolio` y el puerto `PortfolioRepository`. |
| Servicio | `backend/src/services/portfolios.jl`: `require_user`, `create_user_portfolio`, `list_user_portfolios`, `get_user_portfolio` y `delete_user_portfolio`. |
| Adaptadores | `backend/src/infrastructure/postgres_portfolios.jl` (tablas `carteras` y `posiciones_cartera`) y `memory_portfolios.jl` (pruebas). |
| API | `GET /api/internal/assets` y `GET`, `POST`, `DELETE /api/internal/portfolios[/{id}]` (ver [API.md](API.md#rutas-internas-de-usuario)). |
| Frontend | `lib/portfolios.ts`, `app/app/carteras/` (páginas y `actions.ts`) y `components/app/PortfolioForm.tsx`. |

## Pruebas

- `backend/test/services/portfolios_tests.jl`: cada regla de `PortfolioDraft`, alta, lista, detalle y borrado, que un usuario no vea ni borre carteras ajenas, y activos o usuarios inexistentes.
- `backend/test/api/portfolios_api_tests.jl`: las rutas con dueño, los errores 400, 403 y 404, y el código 201 al crear.
- `backend/test/infrastructure/postgres_portfolios_tests.jl`: lo mismo contra PostgreSQL real, más la atomicidad (un activo inexistente no deja nada) y el borrado en cascada de las posiciones.
- De punta a punta (manual, 2026-11-05): crear una cartera desde el formulario (suma en vivo, "repartir en partes iguales", guardar), verla, comprobar que otro usuario recibe 404, y borrarla.

## Siguiente paso

Simular una cartera guardada con los precios históricos de la base y guardar el resultado en `simulaciones` (RF-47).
