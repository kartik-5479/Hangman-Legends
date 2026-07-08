from __future__ import annotations

from dataclasses import dataclass

DIFFICULTY_CONFIG = {
    "Easy": {"lives": 8, "timer": 90, "color": "#41ff9b", "icon": "sparkles"},
    "Medium": {"lives": 6, "timer": 60, "color": "#ffb347", "icon": "zap"},
    "Hard": {"lives": 5, "timer": 45, "color": "#ff4d6d", "icon": "flame"},
    "Nightmare": {"lives": 5, "timer": 30, "color": "#a780ff", "icon": "skull"},
}

ACHIEVEMENTS = {
    "First Win": "Win your first game.",
    "Perfect Game": "Win without a wrong guess.",
    "10 Wins": "Win 10 games.",
    "25 Wins": "Win 25 games.",
    "Hard Mode Winner": "Win a game on Hard.",
    "Nightmare Winner": "Win a game on Nightmare.",
    "100 Correct Letters": "Guess 100 correct letters.",
    "Speed Runner": "Win with at least half the timer remaining.",
}


@dataclass
class GuessResult:
    status: str
    message: str
    changed: bool = False


class HangmanGame:
    def __init__(self, word: str, difficulty: str, guessed: set[str] | None = None, wrong: set[str] | None = None):
        self.word = word.lower()
        self.difficulty = difficulty
        self.max_lives = DIFFICULTY_CONFIG[difficulty]["lives"]
        self.guessed = guessed or set()
        self.wrong = wrong or set()

    @property
    def lives_left(self) -> int:
        return self.max_lives - len(self.wrong)

    @property
    def display_word(self) -> list[str]:
        return [letter.upper() if letter in self.guessed else "_" for letter in self.word]

    @property
    def is_won(self) -> bool:
        return all(letter in self.guessed for letter in set(self.word))

    @property
    def is_lost(self) -> bool:
        return self.lives_left <= 0

    @property
    def progress(self) -> float:
        return len(self.wrong) / self.max_lives

    def guess(self, raw_letter: str) -> GuessResult:
        letter = raw_letter.strip().lower()[:1]
        if not letter.isalpha():
            return GuessResult("ignored", "Pick a letter from A to Z.")
        if letter in self.guessed or letter in self.wrong:
            return GuessResult("used", "That letter is already on the board.")

        if letter in self.word:
            self.guessed.add(letter)
            return GuessResult("correct", "Great job!", True)

        self.wrong.add(letter)
        if self.lives_left == 1:
            return GuessResult("danger", "Careful! One chance remaining.", True)
        return GuessResult("wrong", "Try another letter.", True)

    def reveal_hint_letter(self) -> str | None:
        hidden = [letter for letter in sorted(set(self.word)) if letter not in self.guessed]
        if not hidden:
            return None
        letter = hidden[0]
        self.guessed.add(letter)
        return letter


def calculate_score(difficulty: str, lives_left: int, seconds_left: int, hints_used: int, wrong_count: int) -> dict[str, int]:
    multiplier = {"Easy": 1, "Medium": 2, "Hard": 3, "Nightmare": 4}[difficulty]
    score = max(0, (100 + lives_left * 25 + seconds_left * 2 - hints_used * 20 - wrong_count * 8) * multiplier)
    return {
        "score": score,
        "xp": 30 * multiplier + lives_left * 3,
        "coins": 12 * multiplier + max(0, lives_left - hints_used),
        "stars": 3 if wrong_count == 0 else 2 if lives_left >= 2 else 1,
    }
