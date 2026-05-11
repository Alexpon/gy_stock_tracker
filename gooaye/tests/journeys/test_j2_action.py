"""Journey 2: Action 決策 — 跟單推薦完整流程

Scenario: 使用者要做投資決策，開啟 Action 頁面：
  1. 查看台股推薦標的 — 確認只顯示「有在做」+「觀察中」
  2. 驗證每張卡片的預期報酬、進場時機、股癌原話
  3. 切到美股 — 確認過濾邏輯一致
  4. 驗證「只是提到」的標的確實不會出現
"""
import re
from playwright.sync_api import expect


def test_action_full_journey(app):
    page = app

    # ── Step 1: Navigate to Action page ──
    page.get_by_role("button", name=re.compile("Action")).click()
    page.wait_for_load_state("networkidle")
    expect(page.locator("text=決策 · Action")).to_be_visible()

    # ── Step 2: TW market view ──
    page.get_by_role("button", name="台股 TW").click()
    page.wait_for_timeout(500)

    expect(page.locator("text=ACTION · 最新 4 集 · 台股")).to_be_visible()
    expect(page.locator("text=今天該跟哪幾檔？")).to_be_visible()

    # 2a. Stats bar
    # Actionable = doing(3) + watching(1) = 4 across both episodes
    card = page.locator("div:has(> div:text-is('可跟標的'))").first
    expect(card.locator("div", has_text=re.compile("^4$"))).to_be_visible()
    expect(page.locator("text=另有 5 檔提到")).to_be_visible()

    # Latest episode
    expect(page.locator("div:has(> div:text-is('最新集數'))").locator("text=EP 654")).to_be_visible()

    # 2b. Verify all 4 actionable TW cards are shown
    # EP654 doing: 2330 台積電, 0050 元大台灣50
    # EP654 watching: 2327 國巨
    # EP630 doing: 2454 聯發科
    expect(page.locator("text=2330").first).to_be_visible()
    expect(page.locator("text=台積電").first).to_be_visible()
    expect(page.locator("text=0050").first).to_be_visible()
    expect(page.locator("text=元大台灣50").first).to_be_visible()
    expect(page.locator("text=2327").first).to_be_visible()
    expect(page.locator("text=國巨").first).to_be_visible()
    expect(page.locator("text=2454").first).to_be_visible()
    expect(page.locator("text=聯發科").first).to_be_visible()

    # 2c. Confidence labels on cards
    expect(page.locator("text=有在做").first).to_be_visible()
    expect(page.locator("text=觀察中").first).to_be_visible()

    # 2d. Mention picks visible in separate "只是提到" section
    expect(page.locator("text=只是提到").first).to_be_visible()
    expect(page.locator("text=鴻海").first).to_be_visible()
    expect(page.locator("text=矽力-KY").first).to_be_visible()

    # 2e. Quotes require expand — click 2330 to see quote
    page.locator("text=2330").first.click()
    page.wait_for_timeout(300)
    expect(page.locator("text=台積電在接下來的蓋的狀態是給的非常好啦")).to_be_visible()

    # 2f. Timing signals — EP654 picks have entry prices close to sparkline last value
    expect(page.locator("text=接近當時價").first).to_be_visible()

    # 2g. 聯發科 from EP630 has risen significantly (entry 1740, sparkline last ~2090)
    expect(page.locator("text=已漲超 10%").first).to_be_visible()

    # 2i. Methodology disclaimer
    expect(page.locator("text=本頁僅供參考，並非投資建議")).to_be_visible()

    # ── Step 3: Switch to US market ──
    page.get_by_role("button", name="美股 US").click()
    page.wait_for_timeout(500)

    expect(page.locator("text=ACTION · 最新 4 集 · 美股")).to_be_visible()

    # 3a. Only 1 actionable US pick: AAPL (watching)
    card = page.locator("div:has(> div:text-is('可跟標的'))").first
    expect(card.locator("div", has_text=re.compile("^1$"))).to_be_visible()

    expect(page.locator("text=AAPL").first).to_be_visible()
    expect(page.locator("text=Apple").first).to_be_visible()
    expect(page.locator("text=觀察中").first).to_be_visible()

    # 3b. AAPL entry price
    expect(page.locator("text=$270.33")).to_be_visible()

    # 3c. AAPL quote — requires expand
    page.locator("text=AAPL").first.click()
    page.wait_for_timeout(300)
    expect(page.locator("text=甚至像那種蘋果的論述")).to_be_visible()

    # 3d. Mention picks visible in separate section
    expect(page.locator("text=只是提到").first).to_be_visible()
    expect(page.locator("text=NVIDIA").first).to_be_visible()
    expect(page.locator("text=Amazon").first).to_be_visible()
