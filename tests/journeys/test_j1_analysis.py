"""Journey 1: Analysis 歷史回測 — 完整 US→TW 資料驗證 (return-to-today version)

Scenario: 使用者打開 Analysis 頁面，從美股切到台股，逐一確認：
  1. 統計卡數字是否正確（總數、命中率至今、平均報酬至今）
  2. 時間軸集數與檔數
  3. 個股回測表格：ticker、名稱、信心度、entry、現價、至今報酬
  4. 跟單策略表格（持有至今版）
  5. 信心度拆分區塊
  6. 累積損益圖表區塊
"""
import re
from playwright.sync_api import expect


def test_analysis_full_journey(app):
    page = app

    # ── Step 1: Navigate to Analysis ──
    page.get_by_role("button", name=re.compile("Analysis")).click()
    page.wait_for_load_state("networkidle")
    expect(page.locator("text=歷史回測 · Analysis")).to_be_visible()

    # ── Step 2: Verify no period selector ──
    for period in ["1W", "2W", "1M", "1Q"]:
        assert page.get_by_role("button", name=period).count() == 0

    # ── Step 3: US market view ──
    page.get_by_role("button", name="美股 US").click()
    page.wait_for_timeout(500)

    # 3a. Stats bar — 6 US picks total
    expect(page.locator("div:has(> div:text-is('總計提及個股'))").locator(
        "div", has_text=re.compile("^6$"))).to_be_visible()
    expect(page.locator("text=觀察 1 · 提到 5")).to_be_visible()

    # 3b. Stats labels use "至今" not period names
    expect(page.locator("text=命中率 (至今)")).to_be_visible()
    expect(page.locator("text=平均報酬 (至今)")).to_be_visible()

    # 3c. Timeline — EP654 has 4 US picks, EP630 has 2
    ep654_btn = page.locator("button", has_text="EP 654")
    expect(ep654_btn.locator("text=4 檔")).to_be_visible()
    ep630_btn = page.locator("button", has_text="EP 630")
    expect(ep630_btn.locator("text=2 檔")).to_be_visible()

    # 3d. Picks table — all 6 US tickers present
    table = page.locator("table").first
    for ticker in ["NVDA", "META", "AMZN", "AAPL", "ASTS", "PSTG"]:
        expect(table.locator(f"td:text-is('{ticker}')").first).to_be_visible()

    # 3e. Table has 現價 and 至今報酬 columns, no period columns
    expect(table.locator("th", has_text="現價")).to_be_visible()
    expect(table.locator("th", has_text="至今報酬")).to_be_visible()
    for period in ["1W", "2W", "1M", "1Q"]:
        assert table.locator(f"th:text-is('{period}')").count() == 0

    # 3f. Table shows holding days
    expect(table.locator("text=/\\d+ 天/").first).to_be_visible()

    # 3g. Entry prices
    expect(table.locator("text=199.98")).to_be_visible()   # NVDA
    expect(table.locator("text=681.36")).to_be_visible()   # META
    expect(table.locator("text=249.19")).to_be_visible()   # AMZN
    expect(table.locator("text=270.33")).to_be_visible()   # AAPL
    expect(table.locator("text=112.55")).to_be_visible()   # ASTS
    expect(table.locator("text=69.89")).to_be_visible()    # PSTG

    # 3h. Confidence labels
    expect(table.locator("text=觀察中")).to_be_visible()
    expect(table.locator("text=只是提到").first).to_be_visible()

    # ── Step 4: Switch to TW market ──
    page.get_by_role("button", name="台股 TW").click()
    page.wait_for_timeout(500)

    # 4a. Stats bar — 9 TW picks total
    expect(page.locator("div:has(> div:text-is('總計提及個股'))").locator(
        "div", has_text=re.compile("^9$"))).to_be_visible()
    expect(page.locator("text=有在做 3 · 觀察 1 · 提到 5")).to_be_visible()

    # 4b. All 9 TW tickers in table
    table = page.locator("table").first
    for ticker in ["2330", "0050", "2317", "2327", "6415", "2454", "2337"]:
        expect(table.locator(f"td:text-is('{ticker}')").first).to_be_visible()

    # 4c. TW entry prices
    expect(table.locator("text=2,030")).to_be_visible()    # 2330
    expect(table.locator("text=84.55")).to_be_visible()    # 0050
    expect(table.locator("text=206.00")).to_be_visible()   # 2317
    expect(table.locator("text=320.00")).to_be_visible()   # 2327
    expect(table.locator("text=361.00")).to_be_visible()   # 6415

    # ── Step 5: Strategy table ──
    expect(page.locator("text=FOLLOW STRATEGY")).to_be_visible()
    expect(page.locator("text=持有至今").first).to_be_visible()
    strategy_table = page.locator("table").nth(1)
    expect(strategy_table.locator("text=EP 654")).to_be_visible()
    expect(strategy_table.locator("text=EP 630")).to_be_visible()
    expect(strategy_table.locator("text=持有天數")).to_be_visible()

    # ── Step 6: Confidence tiers ──
    expect(page.locator("text=CONFIDENCE TIERS")).to_be_visible()
    expect(page.locator("text=有在做").first).to_be_visible()
    expect(page.locator("text=觀察中").first).to_be_visible()
    expect(page.locator("text=只是提到").first).to_be_visible()

    # ── Step 7: Cumulative P&L chart ──
    expect(page.locator("text=CUMULATIVE P&L")).to_be_visible()
