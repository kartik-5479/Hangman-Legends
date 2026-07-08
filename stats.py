from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from utils.game_logic import ACHIEVEMENTS

ROOT = Path(__file__).resolve().parents[1]
STATS_PATH = ROOT / "data" / "stats.json"


def load_stats() -> dict[str, Any]:
    with STATS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_stats(stats: dict[str, Any]) -> None:
    STATS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with STATS_PATH.open("w", encoding="utf-8") as file:
        json.dump(stats, file, indent=2)


def reset_stats() -> dict[str, Any]:
    stats = {
        "games_played": 0,
        "wins": 0,
        "losses": 0,
        "current_score": 0,
        "highest_score": 0,
        "correct_guesses": 0,
        "wrong_guesses": 0,
        "win_streak": 0,
        "best_streak": 0,
        "xp": 0,
        "coins": 0,
        "stars": 0,
        "category_counts": {},
        "total_time": 0,
        "achievements": [],
    }
    save_stats(stats)
    return stats


def favorite_category(stats: dict[str, Any]) -> str:
    counts = stats.get("category_counts", {})
    if not counts:
        return "None yet"
    return max(counts, key=counts.get)


def update_after_game(
    *,
    won: bool,
    score: int,
    xp: int,
    coins: int,
    stars: int,
    correct_delta: int,
    wrong_delta: int,
    elapsed: int,
    category: str,
    difficulty: str,
    perfect: bool,
    speed_runner: bool,
) -> list[str]:
    stats = load_stats()
    stats["games_played"] += 1
    stats["wins"] += int(won)
    stats["losses"] += int(not won)
    stats["current_score"] = score if won else 0
    stats["highest_score"] = max(stats["highest_score"], score)
    stats["correct_guesses"] += correct_delta
    stats["wrong_guesses"] += wrong_delta
    stats["win_streak"] = stats["win_streak"] + 1 if won else 0
    stats["best_streak"] = max(stats["best_streak"], stats["win_streak"])
    stats["xp"] += xp if won else 5
    stats["coins"] += coins if won else 2
    stats["stars"] += stars if won else 0
    stats["total_time"] += elapsed
    stats.setdefault("category_counts", {})
    stats["category_counts"][category] = stats["category_counts"].get(category, 0) + 1

    unlocked = set(stats.get("achievements", []))
    before = set(unlocked)
    if won:
        unlocked.add("First Win")
    if perfect and won:
        unlocked.add("Perfect Game")
    if stats["wins"] >= 10:
        unlocked.add("10 Wins")
    if stats["wins"] >= 25:
        unlocked.add("25 Wins")
    if won and difficulty == "Hard":
        unlocked.add("Hard Mode Winner")
    if stats["correct_guesses"] >= 100:
        unlocked.add("100 Correct Letters")
    if won and speed_runner:
        unlocked.add("Speed Runner")

    stats["achievements"] = [name for name in ACHIEVEMENTS if name in unlocked]
    save_stats(stats)
    return [name for name in stats["achievements"] if name not in before]
