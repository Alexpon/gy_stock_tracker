"""E2E tests for navigation and cross-page consistency."""
import re

import pytest


class TestNavigation:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = home

    def test_sidebar_has_three_items(self):
        assert self.page.get_by_role("button", name=re.compile("Action")).is_visible()
        assert self.page.get_by_role("button", name=re.compile("Analysis")).is_visible()
        assert self.page.get_by_role("button", name=re.compile("Episodes")).is_visible()

    def test_sidebar_labels(self):
        assert self.page.locator("text=決策").first.is_visible()
        assert self.page.locator("text=分析").first.is_visible()
        assert self.page.locator("text=集數管理").first.is_visible()

    def test_navigate_to_action(self):
        self.page.get_by_role("button", name=re.compile("Action")).click()
        self.page.wait_for_timeout(300)
        assert self.page.locator("text=決策 · Action").is_visible()
        btn = self.page.get_by_role("button", name=re.compile("Action"))
        assert "active" in (btn.get_attribute("class") or "") or \
               btn.evaluate("el => getComputedStyle(el).backgroundColor") != "rgba(0, 0, 0, 0)"

    def test_navigate_to_analysis(self):
        self.page.get_by_role("button", name=re.compile("Analysis")).click()
        self.page.wait_for_timeout(300)
        assert self.page.locator("text=歷史回測 · Analysis").is_visible()

    def test_navigate_to_episodes(self):
        self.page.get_by_role("button", name=re.compile("Episodes")).click()
        self.page.wait_for_timeout(300)
        assert self.page.locator("text=集數管理 · Episodes").is_visible()

    def test_market_toggle_visible_on_action(self):
        self.page.get_by_role("button", name=re.compile("Action")).click()
        self.page.wait_for_timeout(300)
        assert self.page.get_by_role("button", name="美股 US").is_visible()
        assert self.page.get_by_role("button", name="台股 TW").is_visible()

    def test_market_toggle_visible_on_analysis(self):
        self.page.get_by_role("button", name=re.compile("Analysis")).click()
        self.page.wait_for_timeout(300)
        assert self.page.get_by_role("button", name="美股 US").is_visible()
        assert self.page.get_by_role("button", name="台股 TW").is_visible()

    def test_market_toggle_hidden_on_episodes(self):
        self.page.get_by_role("button", name=re.compile("Episodes")).click()
        self.page.wait_for_timeout(300)
        assert self.page.get_by_role("button", name="美股 US").count() == 0
        assert self.page.get_by_role("button", name="台股 TW").count() == 0

    def test_period_selector_on_analysis(self):
        self.page.get_by_role("button", name=re.compile("Analysis")).click()
        self.page.wait_for_timeout(300)
        for period in ["1W", "2W", "1M", "1Q"]:
            assert self.page.get_by_role("button", name=period).is_visible()

    def test_branding(self):
        assert self.page.locator("text=Gooaye").first.is_visible()
        assert self.page.locator("text=MONITOR").first.is_visible()

    def test_footer_info(self):
        assert self.page.locator("text=合成資料原型 · 非投資建議").is_visible()

    def test_roundtrip_navigation(self):
        """Navigate through all pages and back to verify no crashes."""
        self.page.get_by_role("button", name=re.compile("Action")).click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=決策 · Action").is_visible()

        self.page.get_by_role("button", name=re.compile("Analysis")).click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=歷史回測 · Analysis").is_visible()

        self.page.get_by_role("button", name=re.compile("Episodes")).click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=集數管理 · Episodes").is_visible()

        self.page.get_by_role("button", name=re.compile("Action")).click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=決策 · Action").is_visible()
