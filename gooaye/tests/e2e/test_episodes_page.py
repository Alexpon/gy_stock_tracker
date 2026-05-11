"""E2E tests for the Episodes management page."""
import re

import pytest
from playwright.sync_api import expect


def _go_episodes(home):
    home.get_by_role("button", name=re.compile("Episodes")).click()
    home.wait_for_load_state("networkidle")
    # Wait for async fetch to complete and table to render
    home.wait_for_selector("text=EP654", timeout=5000)
    return home


class TestEpisodesPage:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_episodes(home)

    def test_header(self):
        expect(self.page.locator("text=集數管理 · Episodes")).to_be_visible()

    def test_no_market_toggle(self):
        assert self.page.get_by_role("button", name="美股 US").count() == 0
        assert self.page.get_by_role("button", name="台股 TW").count() == 0

    def test_scan_button(self):
        expect(self.page.get_by_role("button", name="掃描新集數")).to_be_visible()

    def test_stats_total(self):
        container = self.page.locator("div:has(> div:text-is('總集數'))")
        expect(container.locator("div:text-is('2')")).to_be_visible()

    def test_stats_completed(self):
        container = self.page.locator("div:has(> div:text-is('已完成'))")
        expect(container.locator("div:text-is('0')")).to_be_visible()

    def test_stats_pending(self):
        container = self.page.locator("div:has(> div:text-is('待處理'))")
        expect(container.locator("div:text-is('2')")).to_be_visible()
        expect(self.page.locator("text=需要處理")).to_be_visible()

    def test_table_headers(self):
        for header in ["集數", "日期", "STT", "股票", "績效", "操作"]:
            expect(self.page.locator(f"text={header}").first).to_be_visible()

    def test_ep654_data(self):
        expect(self.page.locator("text=EP654").first).to_be_visible()
        expect(self.page.locator("text=04-18")).to_be_visible()

    def test_ep654_stt_status(self):
        ep654_section = self.page.locator("div", has=self.page.locator("text=EP654")).filter(
            has=self.page.locator("text=04-18"))
        expect(ep654_section.locator("text=✓").first).to_be_visible()

    def test_ep654_picks_count(self):
        expect(self.page.locator("text=9").first).to_be_visible()

    def test_ep630_data(self):
        expect(self.page.locator("text=EP630").first).to_be_visible()
        expect(self.page.locator("text=01-24")).to_be_visible()

    def test_ep630_picks_count(self):
        expect(self.page.locator("text=6").first).to_be_visible()

    def test_process_buttons_exist(self):
        buttons = self.page.get_by_role("button", name=re.compile("^處理$"))
        expect(buttons.first).to_be_visible()
        assert buttons.count() == 2

    def test_episodes_sorted_newest_first(self):
        ep_labels = self.page.locator("text=/^EP\\d{3}$/")
        texts = ep_labels.all_inner_texts()
        ep_nums = [t for t in texts if t.startswith("EP6")]
        assert ep_nums[0] == "EP654"
        assert ep_nums[1] == "EP630"
