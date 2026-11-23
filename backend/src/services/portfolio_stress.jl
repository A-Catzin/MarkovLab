# Comparación de escenarios sin tocar la cartera ni escribir simulaciones.
const STRESS_ANNUALIZATION = 252
const MAX_STRESS_DRAWS_PER_SCENARIO = 10_000_000
const MAX_STRESS_SEED = 9_007_199_254_740_991 # entero exacto en clientes JSON/JavaScript

function validate_stress_parameters(simulations, horizon, confidence, seed, years, shift, multiplier, correction)
    1 <= simulations <= MAX_SIMULATIONS || throw(ArgumentError("simulations must be between 1 and $MAX_SIMULATIONS"))
    1 <= horizon <= MAX_HORIZON || throw(ArgumentError("horizon must be between 1 and $MAX_HORIZON"))
    simulations * horizon <= MAX_STRESS_DRAWS_PER_SCENARIO ||
        throw(ArgumentError("simulations times horizon must be at most $MAX_STRESS_DRAWS_PER_SCENARIO"))
    1 <= years <= MAX_LOOKBACK_YEARS || throw(ArgumentError("lookback_years must be between 1 and $MAX_LOOKBACK_YEARS"))
    validate_confidence(confidence)
    (seed === nothing || 0 <= seed <= MAX_STRESS_SEED) ||
        throw(ArgumentError("seed must be between 0 and $MAX_STRESS_SEED"))
    -1 <= shift <= 1 || throw(ArgumentError("return_shift must be between -1 and 1"))
    0 < multiplier <= 10 || throw(ArgumentError("volatility_multiplier must be greater than 0 and at most 10"))
    -1 <= correction <= 1 || throw(ArgumentError("correlation_shift must be between -1 and 1"))
end

# Combina covarianzas semidefinidas positivas. No se recorta cada correlación
# por separado: hacerlo puede dar una matriz imposible para una cartera.
function stress_covariance(cov, multiplier, shift)
    scale = multiplier^2
    iszero(shift) && return scale .* cov
    deviations = [sqrt(cov[i, i]) for i in axes(cov, 1)]
    active = count(>(0), deviations)
    active <= 1 && return scale .* cov
    alpha = abs(shift)
    target = shift > 0 ? 1.0 : -1 / (active - 1)
    stressed = copy(cov)
    for i in axes(cov, 1), j in (i + 1):size(cov, 2)
        blended = (1 - alpha) * cov[i, j] + alpha * target * deviations[i] * deviations[j]
        stressed[i, j] = stressed[j, i] = blended
    end
    return scale .* stressed
end

function stress_totals(summary, capital, horizon, seed)
    return (; horizon_days=horizon, confidence=summary.confidence, seed, simulations=summary.scenarios,
             expected_final_value=capital * (1 + summary.mean),
             median_final_value=capital * (1 + summary.percentiles[50]),
             p5_final_value=capital * (1 + summary.percentiles[5]),
             p95_final_value=capital * (1 + summary.percentiles[95]),
             var_fraction=summary.value_at_risk, var_amount=capital * summary.value_at_risk,
             cvar_fraction=summary.conditional_value_at_risk, cvar_amount=capital * summary.conditional_value_at_risk)
end

function stress_user_portfolio(users::UserRepository, portfolios::PortfolioRepository, prices::PriceRepository,
                               actor, id; horizon, simulations=DEFAULT_SIMULATIONS, confidence=DEFAULT_CONFIDENCE,
                               lookback_years=DEFAULT_LOOKBACK_YEARS, seed=nothing, return_shift=0.0,
                               volatility_multiplier=1.0, correlation_shift=0.0)
    saved = get_user_portfolio(users, portfolios, actor, id)
    saved === nothing && return nothing
    validate_stress_parameters(simulations, horizon, confidence, seed, lookback_years,
                               return_shift, volatility_multiplier, correlation_shift)
    series = portfolio_price_series(prices, saved)
    common = aligned_prices(series; from=typemin(Date), min_days=MIN_SIMULATION_DAYS)
    window = aligned_prices(series; from=last(common.dates) - Year(lookback_years), min_days=MIN_SIMULATION_DAYS)
    portfolio = Portfolio([position.symbol for position in saved.positions], [position.weight for position in saved.positions])
    calibration = run_monte_carlo(portfolio, window.prices; simulations, horizon, confidence, seed)
    used_seed = calibration.parameters.seed
    returns = reduce(hcat, simple_returns.(window.prices))
    means = [mean_return(view(returns, :, j)) + return_shift / STRESS_ANNUALIZATION for j in axes(returns, 2)]
    stressed_cov = stress_covariance(covariance_matrix(returns), volatility_multiplier, correlation_shift)
    outcomes = simulate_portfolio_returns(portfolio, means, stressed_cov; simulations, horizon, seed=used_seed)
    baseline = stress_totals(calibration.summary, saved.capital, horizon, used_seed)
    stressed = stress_totals(summarize_outcomes(outcomes; confidence), saved.capital, horizon, used_seed)
    deltas = (; expected_final_value=stressed.expected_final_value - baseline.expected_final_value,
              var_fraction=stressed.var_fraction - baseline.var_fraction, var_amount=stressed.var_amount - baseline.var_amount,
              cvar_fraction=stressed.cvar_fraction - baseline.cvar_fraction, cvar_amount=stressed.cvar_amount - baseline.cvar_amount)
    return (; portfolio_id=saved.id, portfolio_name=saved.name, saved.capital, saved.currency, model=calibration.model,
             window=(from=string(first(window.dates)), to=string(last(window.dates))), observations=length(window.dates),
             lookback_years, shock=(; return_shift, volatility_multiplier, correlation_shift), baseline, stressed, deltas)
end
