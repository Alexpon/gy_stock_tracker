from backend import ticker_map


def test_lookup_chinese_name():
    result = ticker_map.lookup("博通")
    assert result == ("AVGO", "Broadcom", "us")


def test_lookup_english_name():
    result = ticker_map.lookup("Broadcom")
    assert result == ("AVGO", "Broadcom", "us")


def test_lookup_tw_stock():
    result = ticker_map.lookup("台積電")
    assert result == ("2330", "台積電", "tw")


def test_lookup_not_found():
    result = ticker_map.lookup("不存在的公司")
    assert result is None


def test_lookup_by_ticker():
    result = ticker_map.lookup_by_ticker("AVGO")
    assert result == ("AVGO", "Broadcom", "us")


def test_lookup_by_ticker_tw():
    result = ticker_map.lookup_by_ticker("2330")
    assert result == ("2330", "台積電", "tw")


def test_add_unknown():
    ticker_map.add("新公司", "NEWCO", "New Company", "us")
    result = ticker_map.lookup("新公司")
    assert result == ("NEWCO", "New Company", "us")


def test_get_all_names():
    names = ticker_map.get_all_names()
    assert "博通" in names
    assert "Broadcom" in names
    assert "台積電" in names
    assert len(names) > 20


def test_get_all_tickers():
    tickers = ticker_map.get_all_tickers()
    assert "AVGO" in tickers
    assert "2330" in tickers
