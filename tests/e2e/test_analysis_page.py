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

    def test_stats_avg_returns(self):
        card = self.page.locator("div", has_text=re.compile("^平均報酬")).locator("..")
        assert card.locator("text=-0.80%").first.is_visible()
        assert self.page.locator("text=2W -4.00%").is_visible()
        assert self.page.locator("text=1M -13.40%").is_visible()

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

    def test_table_entry_prices(self):
        table = self.page.locator("table").first
        assert table.locator("text=199.98").is_visible()
        assert table.locator("text=681.36").is_visible()
        assert table.locator("text=249.19").is_visible()
        assert table.locator("text=270.33").is_visible()
        assert table.locator("text=112.55").is_visible()
        assert table.locator("text=69.89").is_visible()

    def test_table_ep630_returns(self):
        table = self.page.locator("table").first
        asts_row = table.locator("tr", has_text="ASTS")
        assert asts_row.locator("text=-1.20%").first.is_visible()
        assert asts_row.locator("text=-9.60%").first.is_visible()
        assert asts_row.locator("text=-23.70%").first.is_visible()

        pstg_row = table.locator("tr", has_text="PSTG")
        assert pstg_row.locator("text=-0.50%").first.is_visible()
        assert pstg_row.locator("text=+1.60%").first.is_visible()
        assert pstg_row.locator("text=-3.10%").first.is_visible()

    def test_table_ep654_no_returns(self):
        table = self.page.locator("table").first
        nvda_row = table.locator("tr", has_text="NVDA")
        cells = nvda_row.locator("td")
        assert cells.nth(5).inner_text() == "—"
        assert cells.nth(6).inner_text() == "—"

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

    def test_stats_avg_returns(self):
        card = self.page.locator("div", has_text=re.compile("^平均報酬")).locator("..")
        assert card.locator("text=+7.").first.is_visible()
        assert self.page.locator("text=2W +2.50%").is_visible()

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

    def test_ep630_tw_returns(self):
        table = self.page.locator("table").first
        tsmc_630 = table.locator("tr", has_text="1,759")
        assert tsmc_630.locator("text=+0.60%").first.is_visible()
        assert tsmc_630.locator("text=+0.80%").first.is_visible()
        assert tsmc_630.locator("text=+7.60%").first.is_visible()

        wanghong = table.locator("tr", has_text="2337").last
        assert wanghong.locator("text=+28.00%").first.is_visible()
        assert wanghong.locator("text=+11.40%").first.is_visible()
        assert wanghong.locator("text=+48.30%").first.is_visible()

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

    def test_cumulative_chart_exists(self):
        assert self.page.locator("text=CUMULATIVE P&L").is_visible()
