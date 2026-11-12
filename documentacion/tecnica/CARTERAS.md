# Mis carteras

Cada usuario crea, ve y borra sus propias carteras (RF-27 a RF-31). Una cartera es cómo se reparte un capital entre activos del catálogo: por ejemplo, 60 % en AAPL y 40 % en MSFT.

## Páginas

| Página | Qué hace |
|---|---|
| `/app/carteras` | Lista las carteras del usuario, de la más nueva a la más vieja. Sin carteras, explica qué es una y ofrece crear la primera. |
| `/app/carteras/nueva` | Formulario: nombre, capital, moneda y una fila por activo con su porcentaje. Muestra la suma en vivo y no deja guardar hasta que dé 100 %. "Repartir en partes iguales" divide el 100 % entre las filas. |
| `/app/carteras/{id}` | Detalle: capital, cantidad de activos, estado, **valor histórico**, **simulación**, barra de composición (RF-31) y tabla con peso y monto de cada activo. Botón "Borrar cartera". |

El formulario solo ofrece activos del catálogo, es decir, los que tienen precios cargados. Si no hay ninguno, lo dice y explica que un admin tiene que cargarlos.

## Reglas

Las valida el backend (`PortfolioDraft`, `backend/src/domain/saved_portfolios.jl`); el formulario solo ayuda.

- **Nombre:** obligatorio, hasta 120 caracteres.
- **Capital:** entre 0.01 (un centavo) y 10¹⁵. Se guarda con 2 decimales, así que nunca queda en 0.00.
- **Moneda:** código ISO de 3 letras (el formulario ofrece MXN, USD y EUR).
- **Activos:** entre 1 y 50, sin repetir, y todos tienen que existir en el catálogo.
- **Pesos:** cada uno entre 0 y 100 %, y en total **100 %** (RF-29). Se guardan como fracción con 8 decimales: 33.33 % se guarda como `0.3333` exacto.
- Una cartera nueva queda en estado `borrador`.

## Valor histórico

La gráfica del detalle muestra cuánto habría valido la cartera día por día si se hubiera comprado con sus pesos y no se moviera (comprar y mantener, sin rebalanceo).

- **El ancla es el día en que la creaste** (`start_date`). Ese día la cartera vale el capital, y la línea vertical punteada lo marca. Antes de esa línea es lo que habría valido; después, lo que vale desde que la creaste. Si se creó hoy, se ancla en el último día con precios.
- **La línea horizontal es el capital**, la referencia contra la que se gana o se pierde.
- **Ventana:** empieza el primer día en que todos los activos tienen precio. Si un activo no cotizó un día (otro mercado, feriado), se usa su último precio.
- **Precio:** el cierre ajustado (o el cierre). Si un día tiene precio de la API y del CSV, se usa el de la API.
- **Periodos:** 1, 5 y 10 años, o todo. El encabezado muestra el valor final y el cambio del periodo; al pasar el cursor (o con las flechas del teclado), el valor de cada día.
- **Tabla:** "Ver los datos por mes" da el último valor de cada mes, para quien no puede ver la gráfica.
- **Limitación:** no se convierte de moneda. Cada activo rinde en la suya, así que una cartera en MXN con MSFT usa el rendimiento de MSFT en dólares.
- Si los activos no tienen al menos dos días de precios en común, en lugar de la gráfica aparece un aviso.

El cálculo es `portfolio_value_history` (`backend/src/domain/portfolio_history.jl`), y lo usa `user_portfolio_history` con el mismo filtro por dueño que el resto de las carteras.

## Simular

El panel "Simular" corre el Monte Carlo del backend (`run_monte_carlo`, modelo `normal-rebalanced-v1`) con los precios reales de la cartera, y guarda cada resultado en `simulaciones` (RF-41 a RF-44, RF-47).

- **Plazo:** 1 mes, 3 meses o 1 año (21, 63 o 252 días hábiles). **Confianza:** 95 % o 99 %. **10,000 escenarios.**
- **Precios:**
  - Se usa el cierre ajustado diario de los últimos 5 años, contados desde el último día en que todos los activos tienen precio.
  - Solo entran los días en que **todos** los activos cotizaron. A diferencia del valor histórico, aquí no se arrastra el último precio: un día inventado sería un rendimiento de cero que bajaría la volatilidad.
  - Hacen falta al menos 60 días.
- **Resultado, en dinero sobre el capital:**
  - el escenario típico (la mediana);
  - el rango donde terminan 9 de cada 10 escenarios (percentiles 5 y 95), en una barra que marca también el capital;
  - el **VaR**: la pérdida máxima con esa confianza;
  - el **CVaR**: la pérdida promedio en los peores casos;
  - la volatilidad diaria.
- **Reproducible (RNF-16, RNF-17):** cada simulación guarda el modelo, la semilla, la cantidad de escenarios, los días de precios usados (`resumen.estimation_window`), los símbolos y los pesos. La página muestra la más reciente; las anteriores quedan en "Simulaciones anteriores".
- **Mismas limitaciones que el valor histórico:** no hay conversión de moneda. Además, el modelo supone rendimientos normales, que subestiman las caídas extremas.

Ejemplo real (2026-11-11), MSFT y WALMEX.MX al 50 %:
- **Ventana:** 1,218 días entre 2021-11-05 y 2026-11-05.
- **Volatilidad diaria:** 1.27 %.
- **A 1 mes:** el escenario típico es +0.5 %, el VaR al 95 % es 8.7 % y el CVaR, 11 %.
- **A 1 año:** el escenario típico es +4.9 % y el VaR al 95 %, 24.3 %.

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
| Simulación | `backend/src/domain/saved_simulations.jl` (`SavedSimulation` y el puerto `SimulationRepository`), `domain/portfolio_history.jl` (`aligned_prices`), `services/portfolio_simulations.jl` (`simulate_user_portfolio`, `list_user_simulations`) y `infrastructure/{memory,postgres}_simulations.jl` (tabla `simulaciones`). |
| Frontend | `lib/portfolios.ts`, `app/app/carteras/` (páginas y `actions.ts`, con `simulatePortfolio`), `components/app/PortfolioForm.tsx`, `PortfolioHistoryChart.tsx` y `PortfolioSimulation.tsx`. |

## Pruebas

- `backend/test/services/portfolios_tests.jl`: cada regla de `PortfolioDraft`, alta, lista, detalle y borrado, que un usuario no vea ni borre carteras ajenas, y activos o usuarios inexistentes.
- `backend/test/api/portfolios_api_tests.jl`: las rutas con dueño, los errores 400, 403 y 404, y el código 201 al crear.
- Simulación:
  - `backend/test/services/portfolio_simulations_tests.jl`: con precios guardados; reproducible con la semilla; la ventana de años; nadie más simula ni ve; parámetros fuera de rango; historia corta.
  - `backend/test/api/simulations_api_tests.jl`: 201 con todos los campos, valores por defecto, 404, 403, 401 y 400.
  - `backend/test/infrastructure/postgres_simulations_tests.jl`: lo guardado se lee idéntico, columnas de la tabla y `ON DELETE SET NULL` al borrar la cartera.
- `backend/test/domain/portfolio_history_tests.jl`: ancla, ventana común, días sin precio de un activo y falta de datos. La historia también se prueba en el servicio (solo para el dueño), en la API (200, 404, 403, 401 y 422) y contra PostgreSQL (`price_history`).
- De punta a punta (2026-11-06): historia real de MSFT y WALMEX.MX al 50 % desde Supabase (6172 días, 2003 a 2026), dibujada en escritorio y en teléfono.
- `backend/test/infrastructure/postgres_portfolios_tests.jl`: lo mismo contra PostgreSQL real, más la atomicidad (un activo inexistente no deja nada) y el borrado en cascada de las posiciones.
- De punta a punta (manual, 2026-11-05): crear una cartera desde el formulario (suma en vivo, "repartir en partes iguales", guardar), verla, comprobar que otro usuario recibe 404, y borrarla.

## Siguiente paso

Simular una cartera guardada con los precios históricos de la base y guardar el resultado en `simulaciones` (RF-47).
