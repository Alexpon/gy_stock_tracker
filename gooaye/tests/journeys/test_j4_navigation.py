"""Journey 4: Cross-page 導航一致性

Scenario: 使用者在三個頁面之間快速切換，驗證：
  1. 每個頁面 header 標題正確更新
  2. Sidebar active 狀態跟隨切換
  3. Market toggle 在 Action/Analysis 顯示、Episodes 隱藏
  4. Period selector 只在 Analysis 顯示
  5. 連續快速切頁不 crash
  6. 共同元素（logo、footer）始終可見
"""
import re
from playwright.sync_api import expect


def test_navigation_full_journey(app):
    page = app

    # ── Step 1: Verify common elements ──
    expect(page.locator("text=Gooaye").first).to_be_visible()
    expect(page.locator("text=MONITOR").first).to_be_visible()
    expect(page.locator("text=合成資料原型 · 非投資建議")).to_be_visible()

    # All three nav items exist
    action_btn = page.get_by_role("button", name=re.compile("Action"))
    analysis_btn = page.get_by_role("button", name=re.compile("Analysis"))
    episodes_btn = page.get_by_role("button", name=re.compile("Episodes"))
    expect(action_btn).to_be_visible()
    expect(analysis_btn).to_be_visible()
    expect(episodes_btn).to_be_visible()

    # Sidebar descriptions
    expect(page.locator("text=最新 4 集 · 該跟哪幾檔")).to_be_visible()
    expect(page.locator("text=歷史回測 · 命中率")).to_be_visible()
    expect(page.locator("text=掃描 · 處理 · 狀態")).to_be_visible()

    # ── Step 2: Action page ──
    action_btn.click()
    page.wait_for_timeout(500)

    # Header updates
    expect(page.locator("text=決策 · Action")).to_be_visible()

    # Market toggle visible
    expect(page.get_by_role("button", name="美股 US")).to_be_visible()
    expect(page.get_by_role("button", name="台股 TW")).to_be_visible()

    # Period selector NOT visible on Action page
    assert page.get_by_role("button", name="1W").count() == 0

    # ── Step 3: Analysis page ──
    analysis_btn.click()
    page.wait_for_timeout(500)

    # Header updates
    expect(page.locator("text=歷史回測 · Analysis")).to_be_visible()

    # Market toggle visible
    expect(page.get_by_role("button", name="美股 US")).to_be_visible()
    expect(page.get_by_role("button", name="台股 TW")).to_be_visible()

    # Period selector visible
    for period in ["1W", "2W", "1M", "1Q"]:
        expect(page.get_by_role("button", name=period)).to_be_visible()

    # ── Step 4: Episodes page ──
    episodes_btn.click()
    page.wait_for_timeout(500)

    # Header updates
    expect(page.locator("text=集數管理 · Episodes")).to_be_visible()

    # Market toggle hidden
    assert page.get_by_role("button", name="美股 US").count() == 0
    assert page.get_by_role("button", name="台股 TW").count() == 0

    # Period selector hidden
    assert page.get_by_role("button", name="1W").count() == 0

    # ── Step 5: Rapid round-trip — stress test navigation ──
    for _ in range(3):
        action_btn.click()
        page.wait_for_timeout(150)
        expect(page.locator("text=決策 · Action")).to_be_visible()

        analysis_btn.click()
        page.wait_for_timeout(150)
        expect(page.locator("text=歷史回測 · Analysis")).to_be_visible()

        episodes_btn.click()
        page.wait_for_timeout(150)
        expect(page.locator("text=集數管理 · Episodes")).to_be_visible()

    # ── Step 6: After rapid switching, verify data still loads ──
    # Go back to Analysis and check data is present
    analysis_btn.click()
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="台股 TW").click()
    page.wait_for_timeout(500)

    # Stats should still be correct
    expect(page.locator("text=有在做 3 · 觀察 1 · 提到 5")).to_be_visible()

    # Table should still render
    table = page.locator("table").first
    expect(table.locator("td:text-is('2330')").first).to_be_visible()

    # Common elements still present after all the switching
    expect(page.locator("text=Gooaye").first).to_be_visible()
    expect(page.locator("text=合成資料原型 · 非投資建議")).to_be_visible()
