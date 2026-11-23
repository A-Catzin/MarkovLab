const REPORT_DESCRIPTIONS = (
    simulation=(code="F2", title="Simulación Monte Carlo", window="window", stats=nothing,
        parameters=("horizon","simulations","confidence","seed","observations"),
        metrics=("value_at_risk","conditional_value_at_risk","expected_period_return","expected_period_volatility")),
    optimization=(code="F4", title="Optimización de cartera", window="window", stats="optimized_stats",
        parameters=("objective","portfolio_version","max_volatility","risk_free_rate","lookback_years","solver"),
        metrics=("annualized_volatility","expected_annual_return","sharpe_ratio")),
    prediction=(code="F5", title="Predicción de activo", window="training_window", stats=nothing,
        parameters=("metric","horizon_days","as_of","parameters"),
        metrics=("point","lower_bound","upper_bound")),
    backtest=(code="F6", title="Backtesting de cartera", window="evaluation", stats="strategy_metrics",
        parameters=("strategy","portfolio_version","configuration","evaluation","rebalance","transaction_cost_bps",
                    "risk_free_rate","benchmark"),
        metrics=("cumulative_return","annualized_volatility","max_drawdown","sharpe_ratio")),
)

const REPORT_METRICS = (
    ("value_at_risk", "VaR", "fraction", "−Q(1−confidence)", "Pérdida en el cuantil de cola.", "Horizonte y confianza de la ejecución."),
    ("conditional_value_at_risk", "CVaR", "fraction", "−mean(tail_returns)", "Pérdida media en la cola.", "Método empírico de la simulación."),
    ("expected_period_return", "Rendimiento esperado por sesión", "fraction", "Σ(wᵢμᵢ)", "Estimación de rendimiento diario.", "Pesos y muestra de calibración."),
    ("expected_period_volatility", "Volatilidad por sesión", "fraction", "√(wᵀΣw)", "Dispersión estimada por sesión.", "Covarianza por sesión."),
    ("expected_annual_return", "Rendimiento esperado anual", "fraction", "252·Σ(wᵢμᵢ)", "Media aritmética anualizada.", "252 sesiones por año."),
    ("annualized_volatility", "Volatilidad anualizada", "fraction", "σ_diaria·√252", "Dispersión anualizada.", "Estimación muestral."),
    ("sharpe_ratio", "Ratio de Sharpe", "ratio", "(μ_anual−r_f)/σ_anual", "Exceso de retorno por unidad de riesgo.", "Nulo si la volatilidad es cero."),
    ("point", "Predicción central", "fraction", "Q(0.5)", "Mediana de la métrica de entrenamiento.", "Rendimiento por sesión o volatilidad anualizada según metric."),
    ("lower_bound", "Límite inferior", "fraction", "Q(0.05)", "Cuantil empírico inferior.", "Métrica de entrenamiento."),
    ("upper_bound", "Límite superior", "fraction", "Q(0.95)", "Cuantil empírico superior.", "Métrica de entrenamiento."),
    ("cumulative_return", "Rendimiento acumulado", "fraction", "V_final/V_inicial−1", "Variación total de la evaluación.", "Neto de los costes simulados de estrategia."),
    ("max_drawdown", "Drawdown máximo", "fraction", "min(V_t/max(V_0…V_t)−1)", "Mayor caída respecto de un máximo previo.", "Ventana de evaluación."),
)

report_formulas() = [(; id, name, unit, formula, interpretation, assumptions)
                     for (id,name,unit,formula,interpretation,assumptions) in REPORT_METRICS]
report_get(x, k) = x isa AbstractDict ? get(x, k, nothing) : nothing

function report_projection(row)
    p = row.payload
    spec = getproperty(REPORT_DESCRIPTIONS, Symbol(row.kind))
    window = report_get(p, spec.window)
    values = spec.stats === nothing ? p : report_get(p, spec.stats)
    formulas = report_formulas()
    metrics = map(spec.metrics) do id
        f = only(x for x in formulas if x.id == id)
        raw = report_get(values, id)
        value = raw isa Real && !(raw isa Bool) && isfinite(raw) ? raw : nothing
        (; id, label=f.name, f.unit, value)
    end
    symbols = report_get(p, "symbols")
    subject = row.kind == "simulation" && symbols isa AbstractVector ? join(symbols, ", ") :
              something(report_get(p, "portfolio_name"), report_get(p, "symbol"), spec.title)
    return (; id=row.kind * ":" * row.id, row.kind, module_code=spec.code, title=spec.title, subject,
             period_from=report_get(window,"from"), period_to=report_get(window,"to"), row.calculated_at,
             origin="api", freshness="unknown", frequency="daily_sessions", currency=report_get(p,"currency"),
             source=(storage="postgresql", price_method="adjusted_close_or_close", ingestion=nothing),
             model=report_get(p,"model"), parameters=Dict(k=>p[k] for k in spec.parameters if haskey(p,k)), metrics)
end

const REPORT_CSV_COLUMNS = ("id","kind","title","subject","period_from","period_to","calculated_at",
                            "currency","model","storage","price_method","metric_id","metric_label","unit","value")
report_csv_field(::Nothing) = ""
report_csv_field(x::Real) = string(x)
function report_csv_field(x)
    raw = string(x)
    visible = lstrip(c -> isspace(c) || iscntrl(c), raw)
    if !isempty(visible) && first(visible) in ('=','+','-','@','＝','＋','－','＠')
        raw = "text: " * visible
    end
    return "\"" * replace(raw, "\"" => "\"\"") * "\""
end

function report_csv(r)
    prefix = (r.id,r.kind,r.title,r.subject,r.period_from,r.period_to,r.calculated_at,r.currency,r.model,
              r.source.storage,r.source.price_method)
    lines = [join(REPORT_CSV_COLUMNS, ',')]
    for metric in r.metrics
        row = (prefix...,metric.id,metric.label,metric.unit,metric.value)
        push!(lines, join(report_csv_field.(row), ','))
    end
    return join(lines, "\r\n") * "\r\n"
end
