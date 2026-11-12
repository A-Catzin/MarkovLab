"""
    InMemorySimulationRepository()

Simulaciones guardadas en memoria, con las mismas reglas que la tabla `simulaciones`. Sirve
para las pruebas.
"""
struct InMemorySimulationRepository <: SimulationRepository
    rows::Vector{Tuple{String,SavedSimulation}}
    lock::ReentrantLock
end

InMemorySimulationRepository() = InMemorySimulationRepository([], ReentrantLock())

function save_simulation(repository::InMemorySimulationRepository, user_id::AbstractString, simulation::SavedSimulation)
    lock(repository.lock) do
        values = [getfield(simulation, f) for f in fieldnames(SavedSimulation)]
        values[1] = random_uuid()
        values[end] = string(Dates.now(Dates.UTC), "Z")
        saved = SavedSimulation(values...)
        push!(repository.rows, (String(user_id), saved))
        return saved
    end
end

function list_simulations(repository::InMemorySimulationRepository, user_id::AbstractString, portfolio_id::AbstractString;
                          limit::Integer=20)
    lock(repository.lock) do
        mine = [s for (owner, s) in repository.rows if owner == user_id && s.portfolio_id == portfolio_id]
        return first(reverse(mine), limit)
    end
end
