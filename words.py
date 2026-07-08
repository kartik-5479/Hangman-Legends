from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORDS_PATH = ROOT / "data" / "words.json"


@dataclass(frozen=True)
class WordPick:
    word: str
    category: str
    clue: str
    difficulty: str = "Medium"
    description: str = ""


def load_words() -> list[dict[str, str]]:
    with WORDS_PATH.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    if isinstance(raw, list):
        return raw

    words: list[dict[str, str]] = []
    for category, entries in raw.items():
        for entry in entries:
            word = entry["word"].lower()
            words.append(
                {
                    "word": word,
                    "category": category,
                    "hint": entry.get("hint") or entry.get("clue", ""),
                    "difficulty": entry.get("difficulty") or _difficulty_for_length(word),
                    "description": entry.get("description") or entry.get("clue", ""),
                }
            )
    return words


def _difficulty_for_length(word: str) -> str:
    length = len(word)
    if 3 <= length <= 5:
        return "Easy"
    if 6 <= length <= 8:
        return "Medium"
    return "Hard"


def _fits_difficulty(word: str, difficulty: str) -> bool:
    length = len(word)
    if difficulty == "Easy":
        return 3 <= length <= 5
    if difficulty == "Medium":
        return 6 <= length <= 8
    if difficulty == "Hard":
        return length >= 9
    return length >= 10


def pick_word(difficulty: str, *, seed: int | None = None) -> WordPick:
    rng = random.Random(seed)
    data = load_words()
    candidates: list[WordPick] = []
    for entry in data:
        word = entry["word"].lower()
        if _fits_difficulty(word, difficulty):
            candidates.append(
                WordPick(
                    word=word,
                    category=entry["category"],
                    clue=entry.get("hint", ""),
                    difficulty=entry.get("difficulty", _difficulty_for_length(word)),
                    description=entry.get("description", ""),
                )
            )

    if not candidates:
        raise ValueError(f"No words found for difficulty {difficulty!r}")
    return rng.choice(candidates)
