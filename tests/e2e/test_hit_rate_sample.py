"""E2E: the hit-rate card shows the positive-return sample size."""
import re


def _go_analysis_us(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    home.get_by_role("button", name="美股 US").click()
    home.wait_for_timeout(300)
    return home


def test_hit_rate_shows_sample_size(home):
    page = _go_analysis_us(home)
    # US seed: 6 picks have return data, 2 are positive (NVDA, AMZN).
    assert page.locator("text=正報酬 2/6 檔").is_visible()
