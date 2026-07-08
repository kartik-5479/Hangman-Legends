from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LEADERBOARD_PATH = ROOT / "data" / "leaderboard.json"


def load_leaderboard() -> dict[str, Any]:
    with LEADERBOARD_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_leaderboard(board: dict[str, Any]) -> None:
    with LEADERBOARD_PATH.open("w", encoding="utf-8") as file:
        json.dump(board, file, indent=2)


def record_result(*, word: str, category: str, difficulty: str, score: int, elapsed: int, won: bool, streak: int) -> None:
    board = load_leaderboard()
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    if won:
        board.setdefault("highest_scores", []).append(
            {"score": score, "word": word.upper(), "category": category, "difficulty": difficulty, "date": stamp}
        )
        board["highest_scores"] = sorted(board["highest_scores"], key=lambda row: row["score"], reverse=True)[:10]
        board.setdefault("fastest_times", []).append(
            {"seconds": elapsed, "word": word.upper(), "category": category, "difficulty": difficulty, "date": stamp}
        )
        board["fastest_times"] = sorted(board["fastest_times"], key=lambda row: row["seconds"])[:10]
    board["highest_streak"] = max(board.get("highest_streak", 0), streak)
    save_leaderboard(board)
