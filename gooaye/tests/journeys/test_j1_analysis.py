"""Journey 1: Analysis 歷史回測 — 完整 US→TW 資料驗證

Scenario: 使用者打開 Analysis 頁面，從美股切到台股，逐一確認：
  1. 統計卡數字是否正確（總數、命中率、平均報酬）
  2. 時間軸集數與檔數
  3. 個股回測表格：ticker、名稱、信心度、entry、各週期報酬
  4. 跟單策略表格
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

    # ── Step 2: US market view ──
    page.get_by_role("button", name="美股 US").click()
    page.wait_for_timeout(500)

    # 2a. Stats bar — 6 US picks total
    expect(page.locator("div:has(> div:text-is('總計提及個股'))").locator(
        "div", has_text=re.compile("^6$"))).to_be_visible()
    expect(page.locator("text=觀察 1 · 提到 5")).to_be_visible()

    # 2b. Avg returns — card value shows main period, sub text shows others
    card = page.locator("div", has_text=re.compile("^平均報酬")).locator("..")
    expect(card.locator("text=-0.80%").first).to_be_visible()
    expect(page.locator("text=2W -4.00%")).to_be_visible()
    expect(page.locator("text=1M -13.40%")).to_be_visible()

    # 2c. Timeline — EP654 has 4 US picks, EP630 has 2
    ep654_btn = page.locator("button", has_text="EP 654")
    expect(ep654_btn.locator("text=4 檔")).to_be_visible()
    ep630_btn = page.locator("button", has_text="EP 630")
    expect(ep630_btn.locator("text=2 檔")).to_be_visible()

    # 2d. Picks table — all 6 US tickers present
    table = page.locator("table").first
    for ticker in ["NVDA", "META", "AMZN", "AAPL", "ASTS", "PSTG"]:
        expect(table.locator(f"td:text-is('{ticker}')").first).to_be_visible()

    # 2e. Verify EP654 picks show "—" for returns (no data)
    nvda_row = table.locator("tr", has_text="NVDA")
    for col_idx in [5, 6, 7, 8]:  # 1W, 2W, 1M, 1Q columns
        assert nvda_row.locator("td").nth(col_idx).inner_text() == "—"

    # 2f. Verify EP630 picks show actual returns
    asts_row = table.locator("tr", has_text="ASTS")
    expect(asts_row.locator("text=-1.20%")).to_be_visible()
    expect(asts_row.locator("text=-9.60%")).to_be_visible()
    expect(asts_row.locator("text=-23.70%")).to_be_visible()

    pstg_row = table.locator("tr", has_text="PSTG")
    expect(pstg_row.locator("text=-0.50%")).to_be_visible()
    expect(pstg_row.locator("text=+1.60%")).to_be_visible()
    expect(pstg_row.locator("text=-3.10%")).to_be_visible()

    # 2g. Entry prices
    expect(table.locator("text=199.98")).to_be_visible()   # NVDA
    expect(table.locator("text=681.36")).to_be_visible()   # META
    expect(table.locator("text=249.19")).to_be_visible()   # AMZN
    expect(table.locator("text=270.33")).to_be_visible()   # AAPL
    expect(table.locator("text=112.55")).to_be_visible()   # ASTS
    expect(table.locator("text=69.89")).to_be_visible()    # PSTG

    # 2h. Confidence labels
    expect(table.locator("text=觀察中")).to_be_visible()
    expect(table.locator("text=只是提到").first).to_be_visible()

    # ── Step 3: Switch to TW market ──
    page.get_by_role("button", name="台股 TW").click()
    page.wait_for_timeout(500)

    # 3a. Stats bar — 9 TW picks total
    expect(page.locator("div:has(> div:text-is('總計提及個股'))").locator(
        "div", has_text=re.compile("^9$"))).to_be_visible()
    expect(page.locator("text=有在做 3 · 觀察 1 · 提到 5")).to_be_visible()

    # 3b. Avg returns — card value shows main period, sub text shows others
    card = page.locator("div", has_text=re.compile("^平均報酬")).locator("..")
    expect(card.locator("text=+7.5").first).to_be_visible()
    expect(page.locator("text=2W +2.50%")).to_be_visible()
    expect(page.locator("text=1M +16.20%")).to_be_visible()

    # 3c. Timeline
    expect(page.locator("button", has_text="EP 654").locator("text=5 檔")).to_be_visible()
    expect(page.locator("button", has_text="EP 630").locator("text=4 檔")).to_be_visible()

    # 3d. All 9 TW tickers in table (2330 appears twice — EP654 and EP630)
    table = page.locator("table").first
    for ticker in ["2330", "0050", "2317", "2327", "6415", "2454", "2337"]:
        expect(table.locator(f"td:text-is('{ticker}')").first).to_be_visible()

    # 3e. EP654 TW entry prices
    expect(table.locator("text=2,030")).to_be_visible()    # 2330
    expect(table.locator("text=84.55")).to_be_visible()    # 0050
    expect(table.locator("text=206.00")).to_be_visible()   # 2317
    expect(table.locator("text=320.00")).to_be_visible()   # 2327
    expect(table.locator("text=361.00")).to_be_visible()   # 6415

    # 3f. EP630 TW returns — verify 旺宏 (highest returns in dataset)
    wanghong_row = table.locator("tr", has_text="2337").last
    expect(wanghong_row.locator("text=+28.00%").first).to_be_visible()
    expect(wanghong_row.locator("text=+11.40%").first).to_be_visible()
    expect(wanghong_row.locator("text=+48.30%").first).to_be_visible()

    # 3g. EP630 台積電 returns
    tsmc_630_row = table.locator("tr", has_text="1,759")
    expect(tsmc_630_row.locator("text=+0.60%").first).to_be_visible()
    expect(tsmc_630_row.locator("text=+0.80%").first).to_be_visible()
    expect(tsmc_630_row.locator("text=+7.60%").first).to_be_visible()

    # 3h. 聯發科 returns
    mtk_row = table.locator("tr", has_text="2454")
    expect(mtk_row.locator("text=+1.10%").first).to_be_visible()
    expect(mtk_row.locator("text=-1.70%").first).to_be_visible()
    expect(mtk_row.locator("text=+2.00%").first).to_be_visible()

    # ── Step 4: Strategy table ──
    expect(page.locator("text=FOLLOW STRATEGY")).to_be_visible()
    strategy_table = page.locator("table").nth(1)
    expect(strategy_table.locator("text=EP 654")).to_be_visible()
    expect(strategy_table.locator("text=EP 630")).to_be_visible()
    # Strategy only includes "doing" picks:
    # EP654: 2330 + 0050 (doing)
    # EP630: 2454 (doing)
    expect(strategy_table.locator("text=2330").first).to_be_visible()
    expect(strategy_table.locator("text=0050").first).to_be_visible()
    expect(strategy_table.locator("text=2454").first).to_be_visible()

    # ── Step 5: Confidence tiers ──
    expect(page.locator("text=CONFIDENCE TIERS")).to_be_visible()
    # Three tiers should appear
    tiers = page.locator("text=有在做").first
    expect(tiers).to_be_visible()
    expect(page.locator("text=觀察中").first).to_be_visible()
    expect(page.locator("text=只是提到").first).to_be_visible()

    # ── Step 6: Cumulative P&L chart ──
    expect(page.locator("text=CUMULATIVE P&L")).to_be_visible()
