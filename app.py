from __future__ import annotations

import json
from pathlib import Path

import streamlit as st


ROOT = Path(__file__).resolve().parent
WORDS_PATH = ROOT / "data" / "words.json"
CSS_PATHS = [ROOT / "css" / "main.css", ROOT / "css" / "animations.css", ROOT / "css" / "themes.css"]
JS_PATHS = [ROOT / "js" / "audio.js", ROOT / "js" / "speech.js", ROOT / "js" / "particles.js", ROOT / "js" / "game.js"]


CURATED_WORDS = {
    "Programming": ["python", "variable", "function", "compiler", "iterator", "recursion", "namespace", "asynchronous", "polymorphism", "serialization"],
    "Technology": ["robot", "browser", "database", "microchip", "algorithm", "bluetooth", "smartphone", "transistor", "nanotechnology", "cryptography"],
    "Food": ["pizza", "burrito", "sandwich", "croissant", "lasagna", "dumpling", "risotto", "sourdough", "cheesecake", "pomegranate"],
    "Sports": ["tennis", "cricket", "football", "skateboard", "badminton", "marathon", "gymnastics", "snowboarding", "championship", "triathlon"],
    "Animals": ["tiger", "dolphin", "elephant", "chimpanzee", "panther", "kangaroo", "crocodile", "rhinoceros", "hummingbird", "chameleon"],
    "Movies": ["frozen", "avatar", "inception", "interstellar", "gladiator", "casablanca", "godfather", "oppenheimer", "blockbuster", "cinematography"],
    "Countries": ["india", "brazil", "australia", "switzerland", "norway", "japan", "argentina", "madagascar", "kazakhstan", "netherlands"],
    "Cars": ["tesla", "mustang", "ferrari", "porsche", "roadster", "bugatti", "lamborghini", "transmission", "convertible", "turbocharger"],
    "Science": ["atom", "laser", "gravity", "molecule", "photosynthesis", "evolution", "microscope", "thermodynamics", "electromagnetism", "biochemistry"],
    "Space": ["comet", "nebula", "asteroid", "constellation", "galaxy", "supernova", "telescope", "cosmonaut", "exoplanet", "observatory"],
    "History": ["empire", "dynasty", "revolution", "renaissance", "archaeology", "civilization", "independence", "chronology", "hieroglyphics", "exploration"],
    "Mythology": ["zeus", "thor", "apollo", "athena", "valkyrie", "poseidon", "anubis", "hercules", "minotaur", "persephone"],
    "Music": ["piano", "guitar", "symphony", "saxophone", "melody", "orchestra", "percussion", "synthesizer", "improvisation", "harmonization"],
    "Famous People": ["einstein", "cleopatra", "tesla", "mandela", "shakespeare", "lovelace", "gandhi", "curie", "newton", "aristotle"],
    "Brands": ["google", "nintendo", "playstation", "spotify", "adidas", "samsung", "microsoft", "starbucks", "pixar", "netflix"],
    "Video Games": ["minecraft", "fortnite", "zelda", "pokemon", "overwatch", "stardew", "valorant", "metroid", "civilization", "speedrunner"],
    "AI": ["neuron", "dataset", "chatbot", "transformer", "embedding", "inference", "alignment", "backpropagation", "multimodal", "reasoning"],
    "Cybersecurity": ["cipher", "firewall", "malware", "phishing", "ransomware", "encryption", "honeypot", "penetration", "authentication", "vulnerability"],
    "Marvel": ["venom", "wakanda", "stark", "avengers", "spiderman", "wolverine", "deadpool", "thunderbolt", "multiverse", "vibranium"],
    "DC": ["batman", "superman", "aquaman", "flash", "cyborg", "watchtower", "metropolis", "gotham", "wonderwoman", "kryptonite"],
    "Anime": ["naruto", "goku", "totoro", "ghibli", "shinobi", "alchemy", "titan", "spirited", "tanjiro", "onepiece"],
}


GENERATORS = {
    "Programming": (["async", "binary", "vector", "lambda", "runtime", "syntax", "kernel", "script"], ["loop", "stack", "queue", "module", "object", "thread", "parser", "cache"]),
    "Technology": (["quantum", "digital", "optic", "cloud", "mobile", "neural", "solar", "pixel"], ["sensor", "engine", "device", "network", "display", "matrix", "signal", "router"]),
    "Food": (["honey", "spiced", "crispy", "golden", "chili", "maple", "velvet", "tropical"], ["wafer", "noodle", "pickle", "custard", "biscuit", "muffin", "sorbet", "tartlet"]),
    "Sports": (["rapid", "power", "street", "arena", "turbo", "legend", "victory", "silver"], ["serve", "sprint", "rally", "keeper", "striker", "skater", "jumper", "runner"]),
    "Animals": (["arctic", "silver", "forest", "desert", "coral", "shadow", "golden", "river"], ["falcon", "otter", "cobra", "panda", "lemur", "eagle", "beetle", "gecko"]),
    "Movies": (["silent", "cosmic", "hidden", "golden", "midnight", "dream", "shadow", "epic"], ["scene", "camera", "script", "sequel", "trailer", "studio", "finale", "cinema"]),
    "Countries": (["north", "south", "upper", "lower", "new", "grand", "royal", "central"], ["island", "valley", "harbor", "capital", "border", "province", "republic", "kingdom"]),
    "Cars": (["turbo", "carbon", "rapid", "electric", "chrome", "nitro", "hybrid", "apex"], ["coupe", "sedan", "engine", "wheel", "piston", "gearbox", "roadster", "chassis"]),
    "Science": (["atomic", "lunar", "plasma", "magnet", "crystal", "bio", "thermal", "sonic"], ["theory", "sample", "reactor", "spectrum", "isotope", "formula", "particle", "labwork"]),
    "Space": (["stellar", "lunar", "solar", "cosmic", "orbital", "meteor", "astral", "nova"], ["probe", "rocket", "planet", "quasar", "station", "lander", "cluster", "voyager"]),
    "History": (["ancient", "royal", "bronze", "marble", "lost", "imperial", "sacred", "frontier"], ["archive", "empire", "treaty", "relic", "citadel", "dynasty", "monument", "chronicle"]),
    "Mythology": (["divine", "oracle", "storm", "sacred", "golden", "shadow", "heroic", "mythic"], ["temple", "titan", "dragon", "phoenix", "helmet", "scepter", "labyrinth", "ambrosia"]),
    "Music": (["bass", "electric", "velvet", "analog", "bright", "soulful", "studio", "rhythm"], ["chorus", "tempo", "ballad", "groove", "concert", "harmony", "mixtape", "overture"]),
    "Famous People": (["brave", "clever", "vision", "noble", "classic", "global", "bright", "iconic"], ["leader", "artist", "thinker", "inventor", "pioneer", "author", "scholar", "champion"]),
    "Brands": (["pixel", "prime", "nova", "hyper", "fresh", "urban", "smart", "lunar"], ["labs", "works", "craft", "studio", "market", "mobile", "cloud", "games"]),
    "Video Games": (["pixel", "stealth", "dragon", "battle", "quest", "arcade", "speed", "legend"], ["runner", "castle", "portal", "weapon", "avatar", "dungeon", "console", "bossfight"]),
    "AI": (["latent", "neural", "prompt", "token", "vector", "agent", "model", "synthetic"], ["memory", "reasoner", "dataset", "trainer", "decoder", "context", "gradient", "pipeline"]),
    "Cybersecurity": (["zero", "stealth", "crypto", "secure", "dark", "packet", "proxy", "token"], ["vault", "cipher", "scanner", "sandbox", "gateway", "defender", "firewall", "checksum"]),
    "Marvel": (["cosmic", "secret", "mighty", "scarlet", "quantum", "heroic", "mutant", "stark"], ["shield", "hammer", "portal", "gauntlet", "panther", "websling", "sentinel", "crusader"]),
    "DC": (["dark", "solar", "gotham", "speed", "justice", "emerald", "krypton", "wonder"], ["knight", "league", "lantern", "signal", "oracle", "fortress", "watcher", "detective"]),
    "Anime": (["spirit", "ninja", "dragon", "mecha", "cosmic", "demon", "starlit", "honor"], ["sensei", "katana", "shonen", "chakra", "alchemy", "tournament", "village", "hero"]),
}


def difficulty_for(word: str) -> str:
    if 3 <= len(word) <= 5:
        return "Easy"
    if 6 <= len(word) <= 8:
        return "Medium"
    if len(word) >= 9:
        return "Hard"
    return "Easy"


def build_word_database(minimum: int = 5200) -> list[dict[str, str]]:
    entries: dict[str, dict[str, str]] = {}
    for category, words in CURATED_WORDS.items():
        for word in words:
            key = word.lower()
            entries[key] = {
                "word": key,
                "category": category,
                "hint": f"A {category.lower()} clue with {len(key)} letters.",
                "difficulty": difficulty_for(key),
                "description": f"{key.title()} belongs to the {category} collection.",
            }

    def alpha_code(number: int) -> str:
        code = ""
        while True:
            code = chr(97 + number % 26) + code
            number = number // 26 - 1
            if number < 0:
                return code

    cycle = 0
    while len(entries) < minimum:
        suffix_code = "" if cycle == 0 else alpha_code(cycle - 1)
        for category, (prefixes, suffixes) in GENERATORS.items():
            for prefix in prefixes:
                for suffix in suffixes:
                    key = f"{prefix}{suffix}{suffix_code}".lower()
                    key = "".join(ch for ch in key if ch.isalpha())
                    if len(key) < 3:
                        continue
                    entries.setdefault(
                        key,
                        {
                            "word": key,
                            "category": category,
                            "hint": f"A generated {category.lower()} legend made from '{prefix}' and '{suffix}'.",
                            "difficulty": "Nightmare" if len(key) >= 12 else difficulty_for(key),
                            "description": f"A themed dictionary entry for high-variety Hangman rounds.",
                        },
                    )
                    if len(entries) >= minimum:
                        break
                if len(entries) >= minimum:
                    break
            if len(entries) >= minimum:
                break
        cycle += 1
    return list(entries.values())


@st.cache_data(show_spinner=False)
def ensure_word_database() -> list[dict[str, str]]:
    WORDS_PATH.parent.mkdir(parents=True, exist_ok=True)
    words: list[dict[str, str]]
    try:
        raw = json.loads(WORDS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        raw = []

    if isinstance(raw, dict):
        words = []
        for category, rows in raw.items():
            for row in rows:
                word = str(row.get("word", "")).lower()
                if word:
                    words.append(
                        {
                            "word": word,
                            "category": category,
                            "hint": row.get("hint") or row.get("clue") or f"A clue from {category}.",
                            "difficulty": row.get("difficulty") or difficulty_for(word),
                            "description": row.get("description") or row.get("clue") or f"A {category} word.",
                        }
                    )
    else:
        words = raw

    if len(words) < 5000 or not all("description" in item for item in words[:25]):
        words = build_word_database()
        WORDS_PATH.write_text(json.dumps(words, indent=2), encoding="utf-8")
    return words


@st.cache_data(show_spinner=False)
def read_text(paths: list[Path]) -> str:
    return "\n".join(path.read_text(encoding="utf-8") for path in paths if path.exists())


def render_game(words: list[dict[str, str]]) -> None:
    css = read_text(CSS_PATHS)
    js = read_text(JS_PATHS)
    payload = json.dumps(words).replace("</", "<\\/")
    html = f"""
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
        <style>{css}</style>
      </head>
      <body>
        <main id="game-root" aria-live="polite"></main>
        <script id="word-data" type="application/json">{payload}</script>
        <script>{js}</script>
      </body>
    </html>
    """
    st.iframe(html, height=940)


def main() -> None:
    st.set_page_config(page_title="Hangman Legends", page_icon="HL", layout="wide", initial_sidebar_state="collapsed")
    st.markdown(
        """
        <style>
          html, body, [data-testid="stAppViewContainer"] { margin: 0; background: #050713; overflow-x: hidden; }
          [data-testid="stHeader"], [data-testid="stToolbar"], [data-testid="stSidebar"], footer, #MainMenu { display: none !important; }
          [data-testid="stAppViewBlockContainer"] { max-width: 100vw; padding: 0 !important; }
          iframe { display: block; width: 100%; border: 0; }
        </style>
        """,
        unsafe_allow_html=True,
    )
    render_game(ensure_word_database())


if __name__ == "__main__":
    main()
