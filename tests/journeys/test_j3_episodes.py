"""Journey 3: Episodes 集數管理 — 狀態查看與操作

Scenario: 使用者管理 podcast 集數，打開 Episodes 頁面：
  1. 查看整體統計（總集數、已完成、待處理）
  2. 檢查每集的處理狀態（STT、股票數、績效）
  3. 測試掃描按鈕（模擬 RSS 掃描）
  4. 確認頁面沒有 market toggle（集數管理不分市場）
  5. 確認排序：新集數在上
"""
import re
from playwright.sync_api import expect


def test_episodes_full_journey(app):
    page = app

    # ── Step 1: Navigate to Episodes page ──
    page.get_by_role("button", name=re.compile("Episodes")).click()
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=EP654", timeout=5000)

    expect(page.locator("text=集數管理 · Episodes")).to_be_visible()

    # ── Step 2: No market toggle on this page ──
    assert page.get_by_role("button", name="美股 US").count() == 0
    assert page.get_by_role("button", name="台股 TW").count() == 0

    # ── Step 3: Stats bar ──
    # Total: 2 episodes
    total_card = page.locator("div:has(> div:text-is('總集數'))")
    expect(total_card.locator("div:text-is('2')")).to_be_visible()

    # Completed: 0 (neither has q1 data)
    completed_card = page.locator("div:has(> div:text-is('已完成'))")
    expect(completed_card.locator("div:text-is('0')")).to_be_visible()

    # Pending: 2
    pending_card = page.locator("div:has(> div:text-is('待處理'))")
    expect(pending_card.locator("div:text-is('2')")).to_be_visible()
    expect(page.locator("text=需要處理")).to_be_visible()

    # ── Step 4: Table headers ──
    for header in ["集數", "日期", "STT", "股票", "族群", "績效", "操作"]:
        expect(page.locator(f"text={header}").first).to_be_visible()

    # ── Step 5: EP654 row verification ──
    # EP654: transcript ✓, 9 picks (5 TW + 4 US), entry prices ✓
    expect(page.locator("text=EP654").first).to_be_visible()
    expect(page.locator("text=04-18")).to_be_visible()

    ep654_row = page.locator("div:text-is('EP654')").locator("..")
    expect(ep654_row.locator("text=✓").first).to_be_visible()
    expect(ep654_row.locator("text=9").first).to_be_visible()
    assert ep654_row.locator("text=✗").count() == 0

    # ── Step 6: EP630 row verification ──
    # EP630: transcript ✓, 6 picks (4 TW + 2 US), entry prices ✓
    expect(page.locator("text=EP630").first).to_be_visible()
    expect(page.locator("text=01-24")).to_be_visible()

    ep630_row = page.locator("div:text-is('EP630')").locator("..")
    expect(ep630_row.locator("text=✓").first).to_be_visible()
    expect(ep630_row.locator("text=6").first).to_be_visible()
    assert ep630_row.locator("text=✗").count() == 0

    # ── Step 7: Process buttons ──
    process_btns = page.get_by_role("button", name=re.compile("^處理$"))
    expect(process_btns.first).to_be_visible()
    assert process_btns.count() == 2, "Both episodes should have process buttons"

    # ── Step 8: Scan button ──
    scan_btn = page.get_by_role("button", name="掃描新集數")
    expect(scan_btn).to_be_visible()
    expect(scan_btn).to_be_enabled()

    # Click scan — should get a response (no new episodes in test fixture)
    scan_btn.click()
    # Wait for scan to complete — button shows "掃描中..." then returns
    page.wait_for_function(
        "() => !document.querySelector('button')?.textContent?.includes('掃描中')",
        timeout=10000,
    )
    # Should see "沒有找到新集數" message
    expect(page.locator("text=沒有找到新集數")).to_be_visible()

    # ── Step 9: Sort order — newest first ──
    ep_labels = page.locator("text=/^EP\\d{3}$/")
    texts = ep_labels.all_inner_texts()
    ep_nums = [t for t in texts if t.startswith("EP6")]
    assert ep_nums[0] == "EP654", f"Expected EP654 first, got {ep_nums[0]}"
    assert ep_nums[1] == "EP630", f"Expected EP630 second, got {ep_nums[1]}"
