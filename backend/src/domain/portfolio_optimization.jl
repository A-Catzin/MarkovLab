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

struct UndefinedSharpeError <: Exception end

# The relative lower bound excludes zero-risk ratios and keeps the scaled
# quadratic equality above the solver's absolute feasibility tolerance.
const SHARPE_MIN_RELATIVE_VOLATILITY = 1e-4
const MAX_SHARPE_SOLVE_SECONDS = 10.0

"""Maximize the signed Sharpe ratio globally, within the solver's tolerances."""
function maximum_sharpe_weights(covariance, expected_returns, lower, upper;
                                risk_free_rate=0.0, max_volatility=nothing)
    n = size(covariance, 1)
    require_matching_assets(expected_returns, n)
    validate_finite(expected_returns, "expected return")
    (risk_free_rate isa Real && !(risk_free_rate isa Bool) && isfinite(risk_free_rate)) ||
        throw(ArgumentError("risk_free_rate must be a finite number"))
    excess = expected_returns .- risk_free_rate
    validate_finite(excess, "excess return")
    least_risk = minimum_variance_weights(covariance, lower, upper; max_volatility)

    max_individual_risk = sqrt(maximum(covariance[i, i] for i in 1:n))
    risk_scale = max_volatility === nothing ? max_individual_risk : min(max_volatility, max_individual_risk)
    risk_scale > 0 || throw(UndefinedSharpeError())
    min_risk = portfolio_volatility(least_risk, covariance)
    risk_lower = iszero(min_risk) ? SHARPE_MIN_RELATIVE_VOLATILITY : min_risk / risk_scale * (1 - 1e-7)
    risk_upper = 1.0
    risk_lower <= risk_upper || throw(OptimizationSolverError("invalid_risk_bounds"))
    return_scale = maximum(abs, excess)
    coefficients = iszero(return_scale) ? zeros(n) : excess ./ return_scale

    model = JuMP.Model(SCIP.Optimizer)
    JuMP.set_silent(model)
    JuMP.set_time_limit_sec(model, MAX_SHARPE_SOLVE_SECONDS)
    JuMP.set_optimizer_attribute(model, "numerics/feastol", 1e-10)
    JuMP.@variable(model, lower[i] <= weight[i=1:n] <= upper[i])
    JuMP.@variable(model, risk_lower <= risk <= risk_upper)
    JuMP.@variable(model, -1 / risk_lower <= score <= 1 / risk_lower)
    JuMP.@constraint(model, sum(weight) == 1)
    JuMP.@constraint(model, risk^2 == sum(((covariance[i, j] / risk_scale) / risk_scale) *
                                          weight[i] * weight[j] for i in 1:n, j in 1:n))
    # Keep the sign of excess return. Squaring the ratio would reverse the
    # ordering for negative Sharpe and can select the worst feasible portfolio.
    JuMP.@constraint(model, score * risk == sum(coefficients[i] * weight[i] for i in 1:n))
    JuMP.@objective(model, Max, score)
    JuMP.optimize!(model)
    status = JuMP.termination_status(model)
    status == JuMP.MOI.INFEASIBLE && throw(UndefinedSharpeError())
    status == JuMP.MOI.OPTIMAL && JuMP.primal_status(model) == JuMP.MOI.FEASIBLE_POINT ||
        throw(OptimizationSolverError(string(status)))
    weights = JuMP.value.(weight)
    realized_risk = portfolio_volatility(weights, covariance) / risk_scale
    (isapprox(sum(weights), 1; atol=1e-8, rtol=0) &&
     all(lower .- 1e-8 .<= weights .<= upper .+ 1e-8) &&
     risk_lower - 1e-8 <= realized_risk <= risk_upper + 1e-8 &&
     isapprox(portfolio_return(weights, coefficients) / realized_risk, JuMP.value(score);
              atol=1e-7, rtol=1e-5)) || throw(OptimizationSolverError("invalid_primal_solution"))
    return weights
end
