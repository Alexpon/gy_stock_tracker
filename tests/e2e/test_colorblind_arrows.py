"""E2E: Analysis return table includes ▲/▼ direction symbols (colorblind aid)."""
import re


def _go_analysis_us(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    home.get_by_role("button", name="美股 US").click()
    home.wait_for_timeout(300)
    return home


def test_table_has_up_and_down_arrows(home):
    page = _go_analysis_us(home)
    table = page.locator("table").first
    # US seed has both positive (NVDA, AMZN) and negative (META, AAPL, ASTS, PSTG) returns.
    assert table.locator("text=▲").first.is_visible()
    assert table.locator("text=▼").first.is_visible()
