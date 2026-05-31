"""E2E tests for the DetailPanel — clicking a pick row opens the detail overlay."""
import re

import pytest


def _go_analysis_tw(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    home.get_by_role("button", name="台股 TW").click()
    home.wait_for_timeout(300)
    return home


class TestDetailPanel:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_analysis_tw(home)

    def test_panel_hidden_initially(self):
        assert self.page.locator("text=節目原話").count() == 0

    def test_click_row_opens_panel(self):
        self.page.locator("table").first.locator("td:text-is('2330')").first.click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=節目原話").is_visible()
        assert self.page.locator("text=回測報酬").is_visible()

    def test_close_button_closes_panel(self):
        self.page.locator("table").first.locator("td:text-is('2330')").first.click()
        self.page.wait_for_timeout(200)
        self.page.get_by_role("button", name="×").click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=節目原話").count() == 0
