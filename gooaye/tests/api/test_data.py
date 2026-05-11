"""API tests for GET /api/data

Verifies:
  - Empty DB → empty response
  - Response structure (episodes, picks, stats)
  - Episodes list with correct fields
  - Picks with sparkline JSON parsed correctly
  - Stats computation per market (total, doing, watching, mention)
  - Hit rate and average return calculations
  - Benchmark comparison fields
  - Best/worst pick identification
"""


def test_data_empty(client):
    resp = client.get("/api/data")
    assert resp.status_code == 200
    data = resp.json()
    assert data["episodes"] == []
    assert data["picks"] == []
    assert data["stats"]["us"] == {}
    assert data["stats"]["tw"] == {}


def test_data_response_structure(seeded_client):
    data = seeded_client.get("/api/data").json()
    assert "episodes" in data
    assert "picks" in data
    assert "stats" in data
    assert "us" in data["stats"]
    assert "tw" in data["stats"]


# ── Episodes ──

def test_data_episodes_count(seeded_client):
    eps = seeded_client.get("/api/data").json()["episodes"]
    assert len(eps) == 2


def test_data_episodes_fields(seeded_client):
    eps = seeded_client.get("/api/data").json()["episodes"]
    ep654 = eps[0]
    assert ep654["ep"] == 654
    assert ep654["title"] == "EP654 | 🌵"
    assert ep654["date"] == "2026-04-18"
    assert ep654["duration"] == "2999"


def test_data_episodes_ordered_newest_first(seeded_client):
    eps = seeded_client.get("/api/data").json()["episodes"]
    assert eps[0]["ep"] == 654
    assert eps[1]["ep"] == 630


# ── Picks ──

def test_data_picks_total_count(seeded_client):
    picks = seeded_client.get("/api/data").json()["picks"]
    assert len(picks) == 15


def test_data_picks_tw_count(seeded_client):
    picks = seeded_client.get("/api/data").json()["picks"]
    tw = [p for p in picks if p["market"] == "tw"]
    assert len(tw) == 9


def test_data_picks_us_count(seeded_client):
    picks = seeded_client.get("/api/data").json()["picks"]
    us = [p for p in picks if p["market"] == "us"]
    assert len(us) == 6


def test_data_pick_fields(seeded_client):
    picks = seeded_client.get("/api/data").json()["picks"]
    tsmc = next(p for p in picks if p["ticker"] == "2330" and p["ep"] == 654)
    assert tsmc["name"] == "台積電"
    assert tsmc["market"] == "tw"
    assert tsmc["confidence"] == "doing"
    assert tsmc["sector"] == "ASIC"
    assert tsmc["quote"] == "台積電在接下來的蓋的狀態是給的非常好啦"
    assert tsmc["entry"] == 2030.0
    assert tsmc["mention_date"] == "2026-04-18"


def test_data_pick_sparkline_parsed(seeded_client):
    """Sparkline stored as JSON string should be parsed to list."""
    picks = seeded_client.get("/api/data").json()["picks"]
    tsmc = next(p for p in picks if p["ticker"] == "2330" and p["ep"] == 654)
    assert tsmc["sparkline"] == [2030, 2050]


def test_data_pick_with_returns(seeded_client):
    picks = seeded_client.get("/api/data").json()["picks"]
    asts = next(p for p in picks if p["ticker"] == "ASTS")
    assert asts["w1"] == -1.2
    assert asts["w2"] == -9.6
    assert asts["m1"] == -23.7
    assert asts["q1"] is None


def test_data_pick_with_benchmark(seeded_client):
    picks = seeded_client.get("/api/data").json()["picks"]
    asts = next(p for p in picks if p["ticker"] == "ASTS")
    assert asts["bench_w1"] == -0.1
    assert asts["bench_w2"] == -0.3
    assert asts["bench_m1"] == -0.8


def test_data_pick_without_returns(seeded_client):
    picks = seeded_client.get("/api/data").json()["picks"]
    nvda = next(p for p in picks if p["ticker"] == "NVDA")
    assert nvda["w1"] is None
    assert nvda["w2"] is None
    assert nvda["m1"] is None
    assert nvda["q1"] is None


# ── Stats: TW ──

def test_stats_tw_total(seeded_client):
    tw = seeded_client.get("/api/data").json()["stats"]["tw"]
    assert tw["total_picks"] == 9


def test_stats_tw_confidence_breakdown(seeded_client):
    tw = seeded_client.get("/api/data").json()["stats"]["tw"]
    assert tw["doing"] == 3      # EP654: 2330, 0050; EP630: 2454
    assert tw["watching"] == 1   # EP654: 2327
    assert tw["mention"] == 5    # EP654: 2317, 6415; EP630: 2330, 0050, 2337


def test_stats_tw_avg_returns(seeded_client):
    """TW returns from EP630 (4 picks with data):
    w1: (0.6+1.1+0.5+28.0)/4 = 7.55 → 7.5 (round to 1dp)
    w2: (0.8+-1.7+-0.5+11.4)/4 = 2.5
    m1: (7.6+2.0+7.1+48.3)/4 = 16.25 → 16.2
    """
    tw = seeded_client.get("/api/data").json()["stats"]["tw"]
    assert tw["avg_w1"] == 7.5
    assert tw["avg_w2"] == 2.5
    assert tw["avg_m1"] == 16.2
    assert tw["avg_q1"] == 0


def test_stats_tw_hit_rates(seeded_client):
    """TW hit rates from EP630 (4 picks with data):
    w1: 3/4 positive (0.6, 1.1, 0.5 positive; 28.0 positive) → 1.0
    w2: 2/4 positive (0.8, 11.4 positive; -1.7, -0.5 negative) → 0.5
    m1: 4/4 positive → 1.0
    """
    tw = seeded_client.get("/api/data").json()["stats"]["tw"]
    assert tw["hit_rate_w1"] == 1.0
    assert tw["hit_rate_w2"] == 0.5
    assert tw["hit_rate_m1"] == 1.0
    assert tw["hit_rate_q1"] == 0


# ── Stats: US ──

def test_stats_us_total(seeded_client):
    us = seeded_client.get("/api/data").json()["stats"]["us"]
    assert us["total_picks"] == 6


def test_stats_us_confidence_breakdown(seeded_client):
    us = seeded_client.get("/api/data").json()["stats"]["us"]
    assert us["doing"] == 0
    assert us["watching"] == 1   # AAPL
    assert us["mention"] == 5    # NVDA, META, AMZN, ASTS, PSTG


def test_stats_us_avg_returns(seeded_client):
    """US returns from EP630 (2 picks with data):
    w1: (-1.2+-0.5)/2 = -0.85 → -0.8
    w2: (-9.6+1.6)/2 = -4.0
    m1: (-23.7+-3.1)/2 = -13.4
    """
    us = seeded_client.get("/api/data").json()["stats"]["us"]
    assert us["avg_w1"] == -0.8
    assert us["avg_w2"] == -4.0
    assert us["avg_m1"] == -13.4
    assert us["avg_q1"] == 0


def test_stats_us_hit_rates(seeded_client):
    """US hit rates: w1: 0/2, w2: 1/2 (PSTG +1.6), m1: 0/2"""
    us = seeded_client.get("/api/data").json()["stats"]["us"]
    assert us["hit_rate_w1"] == 0.0
    assert us["hit_rate_w2"] == 0.5
    assert us["hit_rate_m1"] == 0.0


def test_stats_us_benchmark_field(seeded_client):
    us = seeded_client.get("/api/data").json()["stats"]["us"]
    assert "vs_spy_q1" in us


def test_stats_tw_benchmark_field(seeded_client):
    tw = seeded_client.get("/api/data").json()["stats"]["tw"]
    assert "vs_0050_q1" in tw


def test_stats_best_worst_no_q1(seeded_client):
    """No picks have q1 data → best/worst are placeholders."""
    us = seeded_client.get("/api/data").json()["stats"]["us"]
    assert us["best_pick"]["ticker"] == "-"
    assert us["worst_pick"]["ticker"] == "-"
