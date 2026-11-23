function report_actor(req)
    require_internal_key(req)
    canonical = HTTP.header(req, "X-Actor-User-Id", "")
    legacy = HTTP.header(req, "X-Actor-Id", "")
    if !isempty(canonical) && !isempty(legacy) && lowercase(canonical) != lowercase(legacy)
        throw(invalid_input("actor headers must agree"))
    end
    return require_user(configured_users(), isempty(canonical) ? legacy : canonical)
end

function configured_reports()
    r = REPORTS[]
    r === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return r
end

get("/api/internal/reports/summary") do req
    handle(req) do req
        actor = report_actor(req)
        raw = Base.get(queryparams(req), "limit", "20")
        limit = tryparse(Int, raw)
        (limit !== nothing && 1 <= limit <= 50) || throw(invalid_input("limit must be between 1 and 50"))
        m = MarkovLabBackend
        rows = m.report_rows(configured_reports(), actor.id; limit)
        response = json((reports=m.report_projection.(rows), formulas=m.report_formulas(),
            export_capabilities=(csv_available=true, expected_columns=m.REPORT_CSV_COLUMNS),
            covered_kinds=keys(m.REPORT_DESCRIPTIONS)))
        HTTP.setheader(response, "Cache-Control" => "private, no-store")
        response
    end
end

get("/api/internal/reports/{id}/export") do req, id
    handle(req) do req
        actor = report_actor(req)
        Base.get(queryparams(req), "format", "csv") == "csv" || throw(invalid_input("only csv format is supported"))
        m = MarkovLabBackend
        parts = split(id, ':'; limit=2)
        (length(parts) == 2 && parts[1] in string.(keys(m.REPORT_DESCRIPTIONS)) && m.is_uuid(parts[2])) ||
            throw(not_found("report not found"))
        rows = m.report_rows(configured_reports(), actor.id; kind=parts[1], id=parts[2], limit=1)
        isempty(rows) && throw(not_found("report not found"))
        report = m.report_projection(only(rows))
        HTTP.Response(200, ["Content-Type"=>"text/csv; charset=utf-8", "Cache-Control"=>"private, no-store",
                            "Content-Disposition"=>"attachment; filename=\"report.csv\""], m.report_csv(report))
    end
end
