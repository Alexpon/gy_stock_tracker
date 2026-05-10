# 股票族群觀點抽取與顯示

## 概述

從股癌逐字稿中抽取「族群」（sector groups）層級的觀點，包含看好/中立/看壞的態度分類與理由，並在 Action 頁面以卡片形式呈現。

## 資料模型

新增 `sectors` table：

```sql
CREATE TABLE IF NOT EXISTS sectors (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ep            INTEGER NOT NULL REFERENCES episodes(ep),
    name          TEXT NOT NULL,
    sentiment     TEXT NOT NULL,  -- bullish / neutral / bearish
    quote         TEXT,
    tickers       TEXT,           -- JSON array of ticker strings
    segment_start REAL,
    segment_end   REAL,
    created_at    TEXT DEFAULT (datetime('now')),
    UNIQUE(ep, name)
);
```

- `name`：自由抽取，使用股癌原始用詞（如「散熱」「AI」「航運」「機器人」）
- `sentiment`：英文 enum，前端顯示轉中文
- `tickers`：JSON array，soft reference 到 picks 中的 ticker
- `UNIQUE(ep, name)`：防止同集重複

## LLM 抽取

### Prompt 擴充

在現有 `SYSTEM_PROMPT` 中新增族群抽取指令：

- 抽取股癌對某類股票**整體態度**的表述
- 必須是明確表達態度才抽取，不是所有產業詞都算
- 同一族群只抽一次（取最明確的態度）

每個族群回傳：
1. `name`：族群名稱（原始用詞）
2. `sentiment`：bullish / neutral / bearish
3. `quote`：代表態度的原話（1-2 句）
4. `tickers`：該族群中有提到的具體個股 ticker
5. `segment_indices`：quote 對應的 segment 索引

### 回傳格式

從 `{"picks": [...]}` 改為 `{"picks": [...], "sectors": [...]}`

## Backend 變更

### db.py
- `init_db()`：新增 sectors DDL
- `insert_sector(ep, name, sentiment, quote, tickers, segment_start, segment_end)`
- `get_sectors_for_episodes(ep_list)` → 供 API 使用

### extract.py
- 解析 LLM 回傳的 `sectors` 陣列
- 驗證 sentiment 值合法
- 呼叫 `_map_segment_timestamps` 取得時間戳
- 呼叫 `db.insert_sector()`
- `run()` 回傳 `(picks, sectors)` tuple

### server.py
- `/api/data`：新增 `sectors` 欄位，限定最新 10 集

### generate.py
- `window.GOOAYE_DATA` 新增 `sectors` 欄位

## 前端 — ActionPage 卡片區

### 位置
Summary bar 和「可跟標的」表格之間。

### 卡片內容
- 族群名稱（粗體）
- Sentiment pill：綠圓點 + 看好 / 灰圓點 + 中立 / 紅圓點 + 看壞
- 集數（最新一次提到的 EP）
- 原話摘要（截斷 ~30 字，斜體）
- 關聯個股 ticker pills（最多 3-4 個，超過顯示 +N）

### 點擊展開
- 完整原話
- 所有關聯個股
- 歷史記錄：同族群在多集出現時，列出每集態度變化

### 合併邏輯
- 同名族群跨集合併為一張卡片
- 顯示最新一集的 sentiment
- 排序：bullish → neutral → bearish
- Market filter：透過 tickers 中個股的 market 判斷；tickers 為空則兩個 market 都顯示

## 影響範圍

後端：`db.py`、`extract.py`、`server.py`、`generate.py`
前端：`ActionPage.jsx`
不影響現有 picks 流程。
