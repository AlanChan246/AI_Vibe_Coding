# UCI Points Race — points calculator

Implements sprint scoring, sprint ties, lap bonuses/penalties, double points on the **last** sprint, and total-points tie-break from the **final sprint**, per UCI Track Regulations **§ 7 Points Race** ([Part 3 E — Track](https://assets.ctfassets.net/761l7gh5x5an/7IE4WjTvQLqeRF5aniDP34/ffccabbbc5b69d25994a5f656ecb2225/PART_3_E_-_As_of_01.01.2026.pdf), articles **3.2.118**, **3.2.119**).

| Sprint place | Normal | Last sprint (doubled) |
|-------------|--------|------------------------|
| 1st | 5 | 10 |
| 2nd | 3 | 6 |
| 3rd | 2 | 4 |
| 4th | 1 | 2 |

- **Tie:** same points for that place; the next place **skips** (two tied 1st → both 5; next rider is 3rd for 2 points).
- **Lap gained** on the bunch: **+20** each; **lap lost**: **−20** each.
- **Tie on total points:** better **final sprint** placing wins (3.2.119).

Article **3.2.125:** a rider who gains a lap at a sprint classification gets **20 + sprint points**. If you already list their sprint order for that lap, the +20 is included via `lap_gains`; do not double-count.

## Requirements

- **Web:** modern browser only (no build step).
- **CLI / library:** Python 3.10+ (uses `|` union types).

## Web app

Open **`web/index.html`** in your browser, or from the `web` folder run `npx --yes serve .` and use the URL shown.

The page UI is **Traditional Chinese (繁體中文)**. Each sprint has **Cantonese speech-to-text** via the Web Speech API with language **`zh-HK`** (best in **Chrome** or **Edge** with microphone permission). It supports the same JSON as the CLI (**匯出／匯入 JSON**), **載入範例**, and line-based sprint entry (one placing per line; comma / `，` / `、` = tie).

## CLI usage

```bash
python uci_points_race.py example-race.json
python uci_points_race.py example-race.json --json
```

Or pipe JSON on stdin:

```bash
type example-race.json | python uci_points_race.py
```

## JSON format

```json
{
  "sprints": [
    { "order": [["RiderA"], ["RiderB", "RiderC"], ["RiderD"]] }
  ],
  "lap_gains": { "RiderA": 1 },
  "lap_losses": { "RiderD": 1 },
  "starting_points": {}
}
```

- **`order`:** array of **tie groups** in finish order. Each group is one or more rider names tied together.
- **Last sprint:** the **last** object in `sprints` is the final sprint (double points per 3.2.118 and tie-break per 3.2.119).
- **`starting_points`:** optional (e.g. Omnium carry-over before the final Points Race per 3.2.251).

## Library

```python
from uci_points_race import compute_standings, sprint_points_for_groups

pts = sprint_points_for_groups([["A", "B"], ["C"]], final_sprint=False)
# A and B: 5 each; C: 2 (3rd place)

rows = compute_standings({"sprints": [...], "lap_gains": {...}})
```
