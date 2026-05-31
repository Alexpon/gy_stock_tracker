"""E2E: the app lands on Action and does not persist the last route across reloads."""
import re


def test_lands_on_action_by_default(home):
    assert home.locator("text=今天該跟哪幾檔").is_visible()


def test_does_not_persist_route_after_reload(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    assert home.locator("text=歷史回測 · Analysis").is_visible()

    home.reload()
    home.wait_for_load_state("networkidle")
    # Must return to Action, not restore Analysis.
    assert home.locator("text=今天該跟哪幾檔").is_visible()
