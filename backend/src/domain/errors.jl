"""
    InsufficientDataError(required, available, context)

Se lanza cuando un cálculo recibe menos observaciones de las que necesita (RF-20).
`required` es la cantidad mínima de observaciones, `available` la cantidad recibida
y `context` el nombre del cálculo que falló.
"""
struct InsufficientDataError <: Exception
    required::Int
    available::Int
    context::String
end

function Base.showerror(io::IO, err::InsufficientDataError)
    print(io, "InsufficientDataError: ", err.context, " requires at least ",
          err.required, " observations, but ", err.available, " were provided")
end

function require_observations(values, required::Int, context::AbstractString)
    available = length(values)
    available < required && throw(InsufficientDataError(required, available, String(context)))
    return nothing
end
