from __future__ import annotations

from pathlib import Path

import streamlit as st

from utils.stats import favorite_category, load_stats

ROOT = Path(__file__).resolve().parents[1]

st.set_page_config(page_title="Statistics | Hangman Arcade", page_icon="📊", layout="wide")
st.markdown(f"<style>{(ROOT / 'css' / 'style.css').read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)
stats = load_stats()

st.markdown('<h1 class="logo" style="font-size: clamp(2.4rem, 7vw, 5rem);">Player<span>Stats</span></h1>', unsafe_allow_html=True)
games = max(1, stats["games_played"])
guesses = max(1, stats["correct_guesses"] + stats["wrong_guesses"])

cols = st.columns(4)
cols[0].metric("Games Played", stats["games_played"])
cols[1].metric("Win Rate", f"{stats['wins'] / games:.0%}")
cols[2].metric("Accuracy", f"{stats['correct_guesses'] / guesses:.0%}")
cols[3].metric("Highest Score", stats["highest_score"])

cols = st.columns(4)
cols[0].metric("Correct Guesses", stats["correct_guesses"])
cols[1].metric("Wrong Guesses", stats["wrong_guesses"])
cols[2].metric("Average Time", f"{stats['total_time'] / games:.1f}s")
cols[3].metric("Favorite Category", favorite_category(stats))

st.markdown('<div class="glass home-panel"><h2>Achievements</h2>', unsafe_allow_html=True)
if stats.get("achievements"):
    st.markdown("".join(f'<span class="achievement">{name}</span>' for name in stats["achievements"]), unsafe_allow_html=True)
else:
    st.write("No achievements yet. Your trophy shelf is waiting.")
st.markdown("</div>", unsafe_allow_html=True)
