# Simulaciones guardadas (RF-47): cada corrida de Monte Carlo sobre una cartera, con todo lo
# necesario para reproducirla (RNF-16, RNF-17).

"""
    SavedSimulation(id, portfolio_id, model, simulations, horizon, confidence, seed, observations,
                    symbols, weights, window, expected_return, expected_volatility, value_at_risk,
                    conditional_value_at_risk, summary, created_at)

Una simulación guardada. `window` es `(desde, hasta)`, los días de precios con que se
estimó; `summary` es el resumen de `summarize_outcomes` con claves de texto (como viaja en
JSON), incluidos los percentiles. Los rendimientos y el VaR/CVaR son fracciones del capital
en el horizonte (`0.05` = 5 %).
"""
struct SavedSimulation
    id::String
    portfolio_id::Union{Nothing,String}
    model::String
    simulations::Int
    horizon::Int
    confidence::Float64
    seed::Int
    observations::Int
    symbols::Vector{String}
    weights::Vector{Float64}
    window::Tuple{Date,Date}
    expected_return::Float64
    expected_volatility::Float64
    value_at_risk::Float64
    conditional_value_at_risk::Float64
    summary::Dict{String,Any}
    created_at::Union{Nothing,String}
end

Base.:(==)(a::SavedSimulation, b::SavedSimulation) =
    all(getfield(a, f) == getfield(b, f) for f in fieldnames(SavedSimulation))

"""
    summary_dict(summary) -> Dict{String,Any}

El resumen de `summarize_outcomes` como diccionario con claves de texto, igual que se
guarda en `simulaciones.resumen` y que lo devuelve la API.
"""
function summary_dict(summary)
    return Dict{String,Any}("scenarios" => summary.scenarios, "mean" => summary.mean, "worst" => summary.worst,
                            "best" => summary.best, "confidence" => summary.confidence,
                            "value_at_risk" => summary.value_at_risk,
                            "conditional_value_at_risk" => summary.conditional_value_at_risk,
                            "percentiles" => Dict{String,Any}(string(p) => v for (p, v) in summary.percentiles))
end

"""
Puerto de simulaciones guardadas. Cada adaptador implementa

    save_simulation(repository, user_id, simulation::SavedSimulation) -> SavedSimulation
    list_simulations(repository, user_id, portfolio_id; limit=20) -> Vector{SavedSimulation}

`save_simulation` ignora `id` y `created_at` de la entrada y devuelve la simulación con los
que le asignó. `list_simulations` devuelve las del usuario para esa cartera, de la más nueva
a la más vieja.
"""
abstract type SimulationRepository end

function save_simulation end
function list_simulations end
