struct OptimizationInfeasibleError <: Exception
    reason::Symbol
    minimum_volatility::Union{Nothing,Float64}
end

struct OptimizationSolverError <: Exception
    status::String
end

function check_optimization_bounds(lower, upper, assets)
    require_matching_assets(lower, assets)
    require_matching_assets(upper, assets)
    for (lo, hi) in zip(lower, upper)
        (isfinite(lo) && isfinite(hi) && 0 <= lo <= hi <= 1) ||
            throw(ArgumentError("weights must satisfy 0 <= min_weight <= max_weight <= 1"))
    end
    sum(lower) > 1 + 1e-12 && throw(OptimizationInfeasibleError(:minimum_weights_exceed_one, nothing))
    sum(upper) < 1 - 1e-12 && throw(OptimizationInfeasibleError(:maximum_weights_below_one, nothing))
    return nothing
end

function optimization_model()
    model = JuMP.Model(HiGHS.Optimizer)
    JuMP.set_silent(model)
    JuMP.set_optimizer_attribute(model, "threads", 1)
    JuMP.set_optimizer_attribute(model, "primal_feasibility_tolerance", 1e-9)
    JuMP.set_optimizer_attribute(model, "dual_feasibility_tolerance", 1e-9)
    JuMP.set_optimizer_attribute(model, "qp_regularization_value", 1e-10)
    return model
end

"""
Solve the convex, long-only quadratic program for a sample covariance matrix.

When `max_volatility` is set, it must use the covariance matrix's time scale.
If the minimum exceeds the cap, no allocation within the bounds can meet it.
"""
function minimum_variance_weights(covariance, lower, upper; max_volatility=nothing)
    n, cols = size(covariance)
    n > 0 && n == cols || throw(ArgumentError("covariance matrix must be nonempty and square"))
    check_optimization_bounds(lower, upper, n)
    if max_volatility !== nothing
        (max_volatility isa Real && !(max_volatility isa Bool) &&
         isfinite(max_volatility) && max_volatility >= 0) ||
            throw(ArgumentError("max_volatility must be a finite, nonnegative number"))
    end
    validate_finite(vec(covariance), "covariance")
    # Scaling preserves the minimizer and avoids a nearly flat QP for low-volatility assets.
    scale = maximum(abs, covariance)
    model = optimization_model()
    JuMP.@variable(model, lower[i] <= weight[i=1:n] <= upper[i])
    JuMP.@constraint(model, sum(weight) == 1)
    if scale > 0
        JuMP.@objective(model, Min, sum((covariance[i, j] / scale) * weight[i] * weight[j]
                                      for i in 1:n, j in 1:n))
    end
    JuMP.optimize!(model)
    status = JuMP.termination_status(model)
    status == JuMP.MOI.OPTIMAL && JuMP.primal_status(model) == JuMP.MOI.FEASIBLE_POINT ||
        throw(OptimizationSolverError(string(status)))
    weights = JuMP.value.(weight)
    if max_volatility !== nothing
        min_volatility = portfolio_volatility(weights, covariance)
        if min_volatility > max_volatility && !isapprox(min_volatility, max_volatility; rtol=1e-8, atol=1e-12)
            throw(OptimizationInfeasibleError(:volatility_cap_below_minimum, min_volatility))
        end
    end
    return weights
end
