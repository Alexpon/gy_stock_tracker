"""E2E tests for the Action page — verifies actionable picks, mention section, timing."""
import re

import pytest


def _go_action(home):
    home.get_by_role("button", name=re.compile("Action")).click()
    home.wait_for_load_state("networkidle")
    return home


class TestActionTW:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_action(home)
        self.page.get_by_role("button", name="台股 TW").click()
        self.page.wait_for_timeout(300)

    def test_header(self):
        assert self.page.locator("text=決策 · Action").is_visible()

    def test_subtitle(self):
        assert self.page.locator("text=ACTION · 最新 4 集 · 台股").is_visible()

    def test_actionable_count(self):
        card = self.page.locator("div", has_text=re.compile("^可跟標的$")).locator("..")
        assert card.locator("div", has_text=re.compile("^4$")).is_visible()

    def test_mention_picks_in_separate_section(self):
        assert self.page.locator("text=只是提到").first.is_visible()

    def test_shows_doing_picks(self):
        assert self.page.locator("text=2330").first.is_visible()
        assert self.page.locator("text=台積電").first.is_visible()
        assert self.page.locator("text=0050").first.is_visible()
        assert self.page.locator("text=元大台灣50").first.is_visible()

    def test_shows_watching_pick(self):
        assert self.page.locator("text=2327").first.is_visible()
        assert self.page.locator("text=國巨").first.is_visible()
        assert self.page.locator("text=觀察中").first.is_visible()

    def test_shows_older_doing_pick(self):
        assert self.page.locator("text=2454").first.is_visible()
        assert self.page.locator("text=聯發科").first.is_visible()

    def test_mention_picks_shown_in_muted_section(self):
        assert self.page.locator("text=鴻海").first.is_visible()
        assert self.page.locator("text=矽力-KY").first.is_visible()

    def test_latest_episode(self):
        stat = self.page.locator("text=最新集數").locator("..")
        assert stat.locator("text=EP 654").is_visible()

    def test_quote_shown_on_expand(self):
        self.page.locator("text=2330").first.click()
        self.page.wait_for_timeout(300)
        assert self.page.locator("text=台積電在接下來的蓋的狀態是給的非常好啦").is_visible()

    def test_methodology_disclaimer(self):
        assert self.page.locator("text=本頁僅供參考，並非投資建議").is_visible()


class TestActionUS:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_action(home)
        self.page.get_by_role("button", name="美股 US").click()
        self.page.wait_for_timeout(300)

    def test_subtitle(self):
        assert self.page.locator("text=ACTION · 最新 4 集 · 美股").is_visible()

    def test_actionable_count(self):
        card = self.page.locator("div", has_text=re.compile("^可跟標的$")).locator("..")
        assert card.locator("div", has_text=re.compile("^1$")).is_visible()

    def test_only_aapl_shown(self):
        assert self.page.locator("text=AAPL").first.is_visible()
        assert self.page.locator("text=Apple").first.is_visible()

    def test_mention_picks_in_separate_section(self):
        assert self.page.locator("text=只是提到").first.is_visible()

    def test_aapl_entry_price(self):
        assert self.page.locator("text=$270.33").is_visible()

    def test_aapl_quote_shown_on_expand(self):
        self.page.locator("text=AAPL").first.click()
        self.page.wait_for_timeout(300)
        assert self.page.locator("text=甚至像那種蘋果的論述").is_visible()
