from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]


def load_css() -> None:
    st.markdown(f"<style>{(ROOT / 'css' / 'style.css').read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)


st.set_page_config(page_title="Leaderboard | Hangman Arcade", page_icon="🏆", layout="wide")
load_css()
board = json.loads((ROOT / "data" / "leaderboard.json").read_text(encoding="utf-8"))

st.markdown('<h1 class="logo" style="font-size: clamp(2.4rem, 7vw, 5rem);">Leader<span>board</span></h1>', unsafe_allow_html=True)
st.metric("Highest Win Streak", board.get("highest_streak", 0))

scores, times = st.columns(2)
with scores:
    st.markdown('<div class="glass home-panel"><h2>Highest Scores</h2>', unsafe_allow_html=True)
    st.dataframe(board.get("highest_scores", []), width="stretch", hide_index=True)
    st.markdown("</div>", unsafe_allow_html=True)
with times:
    st.markdown('<div class="glass home-panel"><h2>Fastest Times</h2>', unsafe_allow_html=True)
    st.dataframe(board.get("fastest_times", []), width="stretch", hide_index=True)
    st.markdown("</div>", unsafe_allow_html=True)
