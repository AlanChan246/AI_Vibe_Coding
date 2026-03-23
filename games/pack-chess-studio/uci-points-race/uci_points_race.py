#!/usr/bin/env python3
"""
UCI Track Regulations — Points Race (§ 7), articles 3.2.118–3.2.119 (and 3.2.125).

Sources: PART_3_E Track Races (e.g. as of 01.01.2026).

- Sprint points: 5, 3, 2, 1 for places 1–4; last sprint after full distance doubles (10, 6, 4, 2).
- Ties: tied riders share the same place and points; the next place number skips (e.g. two 1st → no 2nd).
- Lap gain / lap loss vs main bunch: +20 / −20 per lap (3.2.118).
- Tie on total points: rank by result in the final sprint (3.2.119).
- If a rider gains a lap at a sprint classification, they receive 20 points plus sprint points (3.2.125);
  model this by including their sprint placing and counting the lap gain (or add +20 explicitly for that event).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass

# Place indices 1..4 → points (normal and final sprint)
SPRINT_POINTS_NORMAL = (5, 3, 2, 1)
SPRINT_POINTS_FINAL = (10, 6, 4, 2)
LAP_POINTS = 20


def sprint_points_for_place(place: int, *, final_sprint: bool) -> int:
    if place < 1 or place > 4:
        return 0
    table = SPRINT_POINTS_FINAL if final_sprint else SPRINT_POINTS_NORMAL
    return table[place - 1]


def sprint_points_for_groups(
    groups: list[list[str]], *, final_sprint: bool
) -> dict[str, int]:
    """
    `groups` is finish order: each inner list is riders tied at that step (same time / same place).
    Example: [["A"], ["B", "C"], ["D"]] → A 5pts, B&C 3pts each, D 1pt (4th place).
    """
    out: dict[str, int] = {}
    place = 1
    for tied in groups:
        if not tied:
            continue
        pts = sprint_points_for_place(place, final_sprint=final_sprint)
        for r in tied:
            rid = str(r).strip()
            if not rid:
                continue
            out[rid] = out.get(rid, 0) + pts
        place += len(tied)
    return out


def merge_points(into: dict[str, int], delta: dict[str, int]) -> None:
    for k, v in delta.items():
        into[k] = into.get(k, 0) + v


def final_sprint_tiebreak_rank(groups: list[list[str]]) -> dict[str, int]:
    """
    Lower rank = better. Tied riders share the same rank; next rank skips (matches place logic).
    """
    rank = 1
    out: dict[str, int] = {}
    for tied in groups:
        if not tied:
            continue
        clean = [str(r).strip() for r in tied if str(r).strip()]
        for r in clean:
            out[r] = rank
        rank += len(clean)
    return out


@dataclass
class RiderStanding:
    rider_id: str
    total_points: int = 0
    sprint_points: int = 0
    lap_gain_points: int = 0
    lap_loss_deduction: int = 0  # positive = points subtracted (20 per lap lost)
    final_sprint_rank: int | None = None  # lower is better; None if unknown

    def breakdown_lines(self) -> list[str]:
        lines = [
            f"  {self.rider_id}: total {self.total_points}",
            f"    sprint subtotal: {self.sprint_points}",
            f"    lap gains (+{LAP_POINTS} each): {self.lap_gain_points}",
            f"    lap loss penalty (subtracted): {self.lap_loss_deduction}",
        ]
        if self.final_sprint_rank is not None:
            lines.append(f"    final sprint tie-break rank: {self.final_sprint_rank} (lower is better)")
        return lines


def compute_standings(spec: dict) -> list[RiderStanding]:
    """
    JSON spec keys:
      sprints: [ { "order": [["A"],["B","C"]] }, ... ]
        The last sprint in the array is the final sprint (double points, 3.2.118).
      lap_gains: { "A": 2, "B": 1 }   (optional) number of laps gained on the bunch
      lap_losses: { "C": 1 }          (optional)
      starting_points: { "A": 12 }   (optional, e.g. Omnium carry-over per 3.2.251)

    Each sprint "order" uses the tie-group format documented above.
    """
    sprints = spec.get("sprints") or []
    if not sprints:
        raise ValueError("spec must contain a non-empty 'sprints' array")

    lap_gains = {str(k): int(v) for k, v in (spec.get("lap_gains") or {}).items()}
    lap_losses = {str(k): int(v) for k, v in (spec.get("lap_losses") or {}).items()}
    starting = {str(k): int(v) for k, v in (spec.get("starting_points") or {}).items()}

    # 3.2.118: points in the last sprint after full distance are doubled → last JSON sprint is final.
    final_index = len(sprints) - 1

    rider_ids: set[str] = set()
    for sp in sprints:
        for grp in sp.get("order") or []:
            for r in grp:
                s = str(r).strip()
                if s:
                    rider_ids.add(s)
    rider_ids.update(lap_gains.keys())
    rider_ids.update(lap_losses.keys())
    rider_ids.update(starting.keys())

    sprint_sub: dict[str, int] = {r: 0 for r in rider_ids}
    for i, sp in enumerate(sprints):
        order = sp.get("order") or []
        groups = [[str(x).strip() for x in g if str(x).strip()] for g in order]
        groups = [g for g in groups if g]
        is_final = i == final_index
        merge_points(sprint_sub, sprint_points_for_groups(groups, final_sprint=is_final))

    final_groups_raw = (sprints[final_index].get("order") or [])
    final_groups = [[str(x).strip() for x in g if str(x).strip()] for g in final_groups_raw]
    final_groups = [g for g in final_groups if g]
    tie_ranks = final_sprint_tiebreak_rank(final_groups)

    standings: dict[str, RiderStanding] = {}
    for r in sorted(rider_ids):
        sg = sprint_sub.get(r, 0)
        lg = lap_gains.get(r, 0) * LAP_POINTS
        ll_ded = lap_losses.get(r, 0) * LAP_POINTS
        sp0 = starting.get(r, 0)
        total = sp0 + sg + lg - ll_ded
        standings[r] = RiderStanding(
            rider_id=r,
            total_points=total,
            sprint_points=sg,
            lap_gain_points=lg,
            lap_loss_deduction=ll_ded,
            final_sprint_rank=tie_ranks.get(r),
        )

    for r, rk in tie_ranks.items():
        if r not in standings:
            ll_ded = lap_losses.get(r, 0) * LAP_POINTS
            sg = sprint_sub.get(r, 0)
            lg = lap_gains.get(r, 0) * LAP_POINTS
            sp0 = starting.get(r, 0)
            standings[r] = RiderStanding(
                rider_id=r,
                total_points=sp0 + sg + lg - ll_ded,
                sprint_points=sg,
                lap_gain_points=lg,
                lap_loss_deduction=ll_ded,
                final_sprint_rank=rk,
            )

    ordered = sorted(
        standings.values(),
        key=lambda x: (
            -x.total_points,
            x.final_sprint_rank if x.final_sprint_rank is not None else 10**9,
            x.rider_id,
        ),
    )
    return ordered


def format_standings_table(rows: list[RiderStanding]) -> str:
    lines = ["Pos  Rider                Total   Sprint   Lap+   Lost   FinalRK"]
    for i, row in enumerate(rows, start=1):
        fr = "" if row.final_sprint_rank is None else str(row.final_sprint_rank)
        lines.append(
            f"{i:<4} {row.rider_id:<20} {row.total_points:>5}   {row.sprint_points:>6}   "
            f"{row.lap_gain_points:>5}   {row.lap_loss_deduction:>4}   {fr:>7}"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="UCI Points Race total points and ranking (3.2.118–119).")
    p.add_argument(
        "input",
        nargs="?",
        help="JSON file path; omit to read stdin",
    )
    p.add_argument("--json", action="store_true", help="print machine-readable JSON instead of table")
    args = p.parse_args(argv)

    if args.input:
        with open(args.input, encoding="utf-8") as f:
            spec = json.load(f)
    else:
        spec = json.load(sys.stdin)

    try:
        rows = compute_standings(spec)
    except (ValueError, TypeError, KeyError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if args.json:
        out = [
            {
                "position": i,
                "rider": r.rider_id,
                "total_points": r.total_points,
                "sprint_points": r.sprint_points,
                "lap_gain_points": r.lap_gain_points,
                "lap_loss_deduction": r.lap_loss_deduction,
                "final_sprint_tiebreak_rank": r.final_sprint_rank,
            }
            for i, r in enumerate(rows, start=1)
        ]
        json.dump(out, sys.stdout, indent=2)
        print()
    else:
        print(format_standings_table(rows))
        print()
        print("Breakdown:")
        for r in rows:
            print("\n".join(r.breakdown_lines()))
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
