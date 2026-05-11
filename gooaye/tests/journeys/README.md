# Journey Tests

User journey tests for the Gooaye dashboard. Each journey simulates a real user
scenario end-to-end, verifying data correctness, navigation, and interactions.

## Structure

```
tests/
├── e2e/           ← fast automated Playwright scripts (pytest-playwright)
├── journeys/      ← scenario-based journey tests (Playwright MCP)
│   ├── README.md
│   ├── conftest.py
│   ├── test_j1_analysis.py    Journey 1: Analysis 歷史回測
│   ├── test_j2_action.py      Journey 2: Action 決策
│   ├── test_j3_episodes.py    Journey 3: Episodes 集數管理
│   └── test_j4_navigation.py  Journey 4: Cross-page 導航
└── test_*.py      ← unit tests
```

## Difference from e2e/

| | `tests/e2e/` | `tests/journeys/` |
|---|---|---|
| Style | Isolated assertions per element | End-to-end user scenario flow |
| Granularity | One test = one check | One test = one full user journey |
| Data verification | Spot checks | Complete data trail with DB cross-reference |
| Run with | `pytest tests/e2e/` | `pytest tests/journeys/` or Playwright MCP |

## Running

```bash
# All journeys
pytest tests/journeys/ -v

# Single journey
pytest tests/journeys/test_j1_analysis.py -v
```
