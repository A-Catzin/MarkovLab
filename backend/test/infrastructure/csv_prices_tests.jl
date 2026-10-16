using Test
using Dates
using MarkovLabBackend

const HEADER = "symbol,date,open,high,low,close,volume\n"

parse_text(text; kwargs...) = parse_prices_csv(IOBuffer(text); kwargs...)

@testset "CSV price import" begin
    @testset "valid rows are parsed and sorted by symbol and date" begin
        result = parse_text(HEADER *
            "MSFT,2026-01-05,1,2,0.5,1.5,10\n" *
            "AAPL,2026-01-05,1,2,0.5,1.5,10\n" *
            "AAPL,2026-01-02,1,2,0.5,1.5,10\n")
        @test isempty(result.errors)
        @test isempty(result.duplicates)
        @test [(b.symbol, b.date) for b in result.bars] ==
              [("AAPL", Date(2026, 1, 2)), ("AAPL", Date(2026, 1, 5)), ("MSFT", Date(2026, 1, 5))]
        @test result.bars[1] == PriceBar("AAPL", Date(2026, 1, 2), 1, 2, 0.5, 1.5, 10)
    end

    @testset "duplicates by symbol and date keep the first row (RF-05)" begin
        result = parse_text(HEADER *
            "AAPL,2026-01-02,1,2,0.5,1.5,10\n" *
            "aapl,2026-01-02,1,3,0.5,2.5,99\n")
        @test length(result.bars) == 1
        @test result.bars[1].close == 1.5
        @test length(result.duplicates) == 1
        @test result.duplicates[1].line == 3
        @test occursin("AAPL", result.duplicates[1].message)
    end

    @testset "invalid rows are reported with their line and skipped" begin
        result = parse_text(HEADER *
            "AAPL,2026-01-02,1,2,0.5,1.5,10\n" *
            "AAPL,02/01/2026,1,2,0.5,1.5,10\n" *
            "AAPL,2026-01-03,abc,2,0.5,1.5,10\n" *
            "AAPL,2026-01-04,1,2,0.5\n" *
            "AAPL,2026-01-05,1,0.9,0.5,1.5,10\n" *
            ",2026-01-06,1,2,0.5,1.5,10\n")
        @test length(result.bars) == 1
        @test [e.line for e in result.errors] == [3, 4, 5, 6, 7]
        @test occursin("date", result.errors[1].message)
        @test occursin("open", result.errors[2].message)
        @test occursin("7", result.errors[3].message)
        @test occursin("high", result.errors[4].message)
        @test occursin("symbol", result.errors[5].message)
    end

    @testset "header is case-insensitive, column order is free and extra columns are ignored" begin
        result = parse_text("Date,Close,Volume,Low,High,Open,Symbol,Adj Close\n" *
                            "2026-01-02,1.5,10,0.5,2,1,AAPL,1.4\n")
        @test result.bars == [PriceBar("AAPL", Date(2026, 1, 2), 1, 2, 0.5, 1.5, 10)]
    end

    @testset "provider column names can be mapped" begin
        result = parse_text("ticker,day,o,h,l,c,v\nAAPL,2026-01-02,1,2,0.5,1.5,10\n";
            columns=Dict("symbol" => "ticker", "date" => "day", "open" => "o",
                         "high" => "h", "low" => "l", "close" => "c", "volume" => "v"))
        @test length(result.bars) == 1
    end

    @testset "symbol keyword fills files without a symbol column" begin
        result = parse_text("date,open,high,low,close,volume\n2026-01-02,1,2,0.5,1.5,10\n"; symbol="aapl")
        @test result.bars[1].symbol == "AAPL"
        @test_throws ArgumentError parse_text("date,open,high,low,close,volume\n2026-01-02,1,2,0.5,1.5,10\n")
    end

    @testset "missing required columns reject the whole file" begin
        err = try
            parse_text("symbol,date,open,high,low,close\nAAPL,2026-01-02,1,2,0.5,1.5\n")
        catch e
            e
        end
        @test err isa ArgumentError
        @test occursin("volume", err.msg)
        @test_throws ArgumentError parse_text("")
    end

    @testset "blank lines, CRLF, BOM and quoted fields are handled" begin
        text = "﻿" * "symbol,date,open,high,low,close,volume\r\n" *
               "\"AAPL\",2026-01-02,1,2,0.5,1.5,\"10\"\r\n" *
               "\r\n" *
               "\"BRK,B\",2026-01-02,1,2,0.5,1.5,10\r\n"
        result = parse_text(text)
        @test isempty(result.errors)
        @test [b.symbol for b in result.bars] == ["AAPL", "BRK,B"]
    end

    @testset "read_prices_csv reads a file" begin
        result = read_prices_csv(joinpath(@__DIR__, "..", "fixtures", "prices_sample.csv"))
        @test [(b.symbol, b.date) for b in result.bars] ==
              [("AAPL", Date(2026, 1, 2)), ("AAPL", Date(2026, 1, 5)), ("MSFT", Date(2026, 1, 2))]
        @test [d.line for d in result.duplicates] == [5]
        @test [e.line for e in result.errors] == [6]
    end

    @testset "imported closes feed the domain metrics" begin
        result = read_prices_csv(joinpath(@__DIR__, "..", "fixtures", "prices_sample.csv"))
        closes = [b.close for b in result.bars if b.symbol == "AAPL"]
        @test simple_returns(closes) ≈ [0.01]
    end
end
