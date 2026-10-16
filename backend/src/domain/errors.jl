"""
    InsufficientDataError(required, available, context)

Raised when a calculation receives fewer observations than it needs (RF-20).
`required` is the minimum number of observations, `available` the number received
and `context` names the calculation that failed.
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
