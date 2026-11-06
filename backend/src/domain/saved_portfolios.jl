# Carteras guardadas de cada usuario (RF-27 a RF-31). `Portfolio` (portfolio.jl) es la
# composición para calcular; aquí está lo que el usuario guarda: nombre, capital, moneda y
# los activos del catálogo con su peso.

const MAX_PORTFOLIO_NAME_LENGTH = 120
const MAX_PORTFOLIO_POSITIONS = 50
# Límites del capital: la columna es numeric(18, 2) y tiene que ser mayor que cero.
const MIN_PORTFOLIO_CAPITAL = 0.01
const MAX_PORTFOLIO_CAPITAL = 1e15

"""
    PositionDraft(asset_id, weight)

Un activo del catálogo (`activos.id`) y su peso como fracción (0.4 = 40 %).
"""
struct PositionDraft
    asset_id::Int
    weight::Float64
end

"""
    PortfolioDraft(name, capital, currency, positions)

Cartera que un usuario quiere guardar. El constructor recorta el nombre y pasa la moneda
a mayúsculas, y lanza `ArgumentError` si:

- el nombre está vacío, trae caracteres de control o pasa de 120 caracteres;
- el capital no es un número finito entre 0.01 y 10¹⁵;
- la moneda no es un código ISO de tres letras;
- no hay posiciones, hay más de 50, un id de activo no es positivo o se repite;
- algún peso no está entre 0 y 1, o los pesos no suman 1 (100 %) dentro de
  `PORTFOLIO_WEIGHT_TOLERANCE` (RF-29).
"""
struct PortfolioDraft
    name::String
    capital::Float64
    currency::String
    positions::Vector{PositionDraft}

    function PortfolioDraft(name::AbstractString, capital::Real, currency::AbstractString,
                            positions::AbstractVector{PositionDraft})
        any(iscntrl, name) && throw(ArgumentError("name must not contain control characters"))
        name = strip(name)
        isempty(name) && throw(ArgumentError("name must not be empty"))
        length(name) > MAX_PORTFOLIO_NAME_LENGTH &&
            throw(ArgumentError("name must have at most $MAX_PORTFOLIO_NAME_LENGTH characters"))
        # Se guarda con 2 decimales: el mínimo es un centavo, para que nunca se guarde 0.00.
        (isfinite(capital) && MIN_PORTFOLIO_CAPITAL <= capital <= MAX_PORTFOLIO_CAPITAL) ||
            throw(ArgumentError("capital must be between 0.01 and 1e15"))
        currency = uppercase(strip(currency))
        occursin(CURRENCY_PATTERN, currency) ||
            throw(ArgumentError("currency must be a three-letter ISO code such as USD or MXN"))
        isempty(positions) && throw(ArgumentError("a portfolio needs at least one asset"))
        length(positions) > MAX_PORTFOLIO_POSITIONS &&
            throw(ArgumentError("a portfolio can have at most $MAX_PORTFOLIO_POSITIONS assets"))
        ids = [position.asset_id for position in positions]
        all(>(0), ids) || throw(ArgumentError("asset ids must be positive"))
        allunique(ids) || throw(ArgumentError("each asset can appear only once"))
        for position in positions
            (isfinite(position.weight) && 0 <= position.weight <= 1) ||
                throw(ArgumentError("weight of asset $(position.asset_id) must be between 0 and 1"))
        end
        total = sum(position.weight for position in positions)
        abs(total - 1) <= PORTFOLIO_WEIGHT_TOLERANCE ||
            throw(ArgumentError("weights must sum to 1 (100 %), got $(round(total; digits=6))"))
        return new(String(name), Float64(capital), String(currency), collect(positions))
    end
end

"""
    SavedPosition(asset_id, symbol, market, name, weight)

Posición de una cartera guardada, con los datos del activo para mostrarla.
"""
struct SavedPosition
    asset_id::Int
    symbol::String
    market::String
    name::String
    weight::Float64
end

"""
    SavedPortfolio(id, name, capital, currency, start_date, status, created_at, positions)

Cartera guardada. `id` es el UUID en texto, `start_date` una fecha ISO, `status` uno de
`:draft`, `:active` o `:archived`, y `created_at` el momento de alta en ISO UTC (o
`nothing`).
"""
struct SavedPortfolio
    id::String
    name::String
    capital::Float64
    currency::String
    start_date::String
    status::Symbol
    created_at::Union{Nothing,String}
    positions::Vector{SavedPosition}
end

Base.:(==)(a::SavedPosition, b::SavedPosition) =
    all(getfield(a, f) == getfield(b, f) for f in fieldnames(SavedPosition))
Base.:(==)(a::SavedPortfolio, b::SavedPortfolio) =
    all(getfield(a, f) == getfield(b, f) for f in fieldnames(SavedPortfolio))

"""
Puerto de persistencia de carteras. Cada adaptador implementa, siempre limitado a las
carteras de `user_id`:

- `create_portfolio(repository, user_id, draft::PortfolioDraft) -> SavedPortfolio`: guarda
  la cartera y sus posiciones en una sola operación; lanza `ArgumentError` si algún activo
  no existe.
- `list_portfolios(repository, user_id) -> Vector{SavedPortfolio}`: de la más nueva a la más vieja.
- `get_portfolio(repository, user_id, id) -> Union{SavedPortfolio,Nothing}`: `nothing` si no
  existe, no es del usuario o el id no es un UUID.
- `delete_portfolio(repository, user_id, id) -> Bool`: `false` en los mismos casos.
"""
abstract type PortfolioRepository end

function create_portfolio end
function list_portfolios end
function get_portfolio end
function delete_portfolio end
