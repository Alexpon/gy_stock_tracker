"""E2E tests for the Analysis page — verifies stats, picks table, and strategy table."""
import re

import pytest


def _go_analysis(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    return home


class TestAnalysisUS:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_analysis(home)
        self.page.get_by_role("button", name="美股 US").click()
        self.page.wait_for_timeout(300)

    def test_header(self):
        assert self.page.locator("text=歷史回測 · Analysis").is_visible()

    def test_stats_total_picks(self):
        assert self.page.locator("text=總計提及個股").is_visible()
        card = self.page.locator("div", has_text=re.compile("^總計提及個股$")).locator("..")
        assert card.locator("div", has_text=re.compile("^6$")).is_visible()

    def test_stats_sub_counts(self):
        assert self.page.locator("text=觀察 1 · 提到 5").is_visible()

    def test_stats_labels_show_return_to_today(self):
        assert self.page.locator("text=命中率 (至今)").is_visible()
        assert self.page.locator("text=平均報酬 (至今)").is_visible()

    def test_no_period_sub_rows(self):
        assert self.page.locator("text=2W -4.00%").count() == 0
        assert self.page.locator("text=1M -13.40%").count() == 0

    def test_timeline_episodes(self):
        assert self.page.locator("text=EP 654").first.is_visible()
        assert self.page.locator("text=EP 630").first.is_visible()

    def test_timeline_pick_counts(self):
        assert self.page.locator("text=4 檔").first.is_visible()
        assert self.page.locator("text=2 檔").first.is_visible()

    def test_table_has_all_us_tickers(self):
        table = self.page.locator("table").first
        for ticker in ["NVDA", "META", "AMZN", "AAPL", "ASTS", "PSTG"]:
            assert table.locator(f"td:text-is('{ticker}')").first.is_visible()

    def test_table_has_current_price_column(self):
        table = self.page.locator("table").first
        assert table.locator("th", has_text="現價").is_visible()

    def test_table_has_return_to_today_column(self):
        table = self.page.locator("table").first
        assert table.locator("th", has_text="至今報酬").is_visible()

    def test_table_no_period_columns(self):
        table = self.page.locator("table").first
        for period in ["1W", "2W", "1M", "1Q"]:
            assert table.locator(f"th:text-is('{period}')").count() == 0

    def test_table_entry_prices(self):
        table = self.page.locator("table").first
        assert table.locator("text=199.98").is_visible()
        assert table.locator("text=681.36").is_visible()
        assert table.locator("text=249.19").is_visible()
        assert table.locator("text=270.33").is_visible()
        assert table.locator("text=112.55").is_visible()
        assert table.locator("text=69.89").is_visible()

    def test_table_shows_holding_days(self):
        table = self.page.locator("table").first
        assert table.locator("text=/\\d+ 天/").first.is_visible()

    def test_confidence_labels(self):
        table = self.page.locator("table").first
        assert table.locator("text=觀察中").is_visible()
        assert table.locator("text=只是提到").first.is_visible()


class TestAnalysisTW:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_analysis(home)
        self.page.get_by_role("button", name="台股 TW").click()
        self.page.wait_for_timeout(300)

    def test_stats_total_picks(self):
        card = self.page.locator("div", has_text=re.compile("^總計提及個股$")).locator("..")
        assert card.locator("div", has_text=re.compile("^9$")).is_visible()

    def test_stats_sub_counts(self):
        assert self.page.locator("text=有在做 3 · 觀察 1 · 提到 5").is_visible()

    def test_stats_labels_show_return_to_today(self):
        assert self.page.locator("text=命中率 (至今)").is_visible()
        assert self.page.locator("text=平均報酬 (至今)").is_visible()

    def test_timeline_pick_counts(self):
        assert self.page.locator("text=5 檔").first.is_visible()
        assert self.page.locator("text=4 檔").first.is_visible()

    def test_table_has_all_tw_tickers(self):
        table = self.page.locator("table").first
        for ticker in ["2330", "0050", "2317", "2327", "6415", "2454", "2337"]:
            assert table.locator(f"td:text-is('{ticker}')").first.is_visible()

    def test_table_entry_prices(self):
        table = self.page.locator("table").first
        assert table.locator("text=2,030").is_visible()
        assert table.locator("text=84.55").is_visible()
        assert table.locator("text=206.00").is_visible()
        assert table.locator("text=320.00").is_visible()
        assert table.locator("text=361.00").is_visible()

    def test_confidence_tiers_section(self):
        assert self.page.locator("text=CONFIDENCE TIERS").is_visible()
        assert self.page.locator("text=有在做").first.is_visible()
        assert self.page.locator("text=觀察中").first.is_visible()
        assert self.page.locator("text=只是提到").first.is_visible()

    def test_strategy_table_exists(self):
        assert self.page.locator("text=FOLLOW STRATEGY").is_visible()
        strategy_table = self.page.locator("table").nth(1)
        assert strategy_table.locator("text=EP 654").is_visible()
        assert strategy_table.locator("text=EP 630").is_visible()

    def test_strategy_table_shows_holding_days(self):
        strategy_table = self.page.locator("table").nth(1)
        assert strategy_table.locator("text=持有天數").is_visible()
        assert strategy_table.locator("text=/\\d+ 天/").first.is_visible()

    def test_strategy_description_says_hold_to_today(self):
        assert self.page.locator("text=持有至今").first.is_visible()

    def test_cumulative_chart_exists(self):
        assert self.page.locator("text=CUMULATIVE P&L").is_visible()
