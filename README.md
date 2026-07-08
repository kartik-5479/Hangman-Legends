# Hangman Arcade

A premium Streamlit Hangman game with a browser-game style interface, animated CSS, keyboard controls, local JSON persistence, themes, score tracking, achievements, and leaderboard/statistics/settings pages.

## Run

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Structure

- `app.py` - main game UI and gameplay loop
- `utils/` - game logic, word loading, stats, leaderboard, speech line helpers
- `data/` - local JSON persistence
- `css/style.css` and `js/script.js` - custom presentation and browser-side effects
- `pages/` - Streamlit multipage leaderboard, statistics, and settings
