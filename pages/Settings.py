from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from utils.stats import reset_stats

ROOT = Path(__file__).resolve().parents[1]
SETTINGS_PATH = ROOT / "data" / "settings.json"
DIFFICULTIES = ["Easy", "Medium", "Hard"]

st.set_page_config(page_title="Settings | Hangman Arcade", page_icon="⚙️", layout="wide")
st.markdown(f"<style>{(ROOT / 'css' / 'style.css').read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)
settings = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))

st.markdown('<h1 class="logo" style="font-size: clamp(2.4rem, 7vw, 5rem);">Game<span>Settings</span></h1>', unsafe_allow_html=True)

with st.form("settings_form"):
    settings["default_difficulty"] = st.selectbox("Default Difficulty", DIFFICULTIES, index=DIFFICULTIES.index(settings.get("default_difficulty", "Easy")))
    settings["volume"] = st.slider("Volume", 0, 100, int(settings.get("volume", 70)))
    settings["sound"] = st.toggle("Sound Effects", value=settings.get("sound", True))
    settings["voice"] = st.toggle("Voice Lines", value=settings.get("voice", True))
    settings["animations"] = st.toggle("Animations", value=settings.get("animations", True))
    saved = st.form_submit_button("Save Settings", width="stretch")
    if saved:
        SETTINGS_PATH.write_text(json.dumps(settings, indent=2), encoding="utf-8")
        st.success("Settings saved.")

st.markdown('<div class="glass home-panel"><h2>Progress</h2>', unsafe_allow_html=True)
if st.button("Reset Progress", width="stretch"):
    reset_stats()
    st.success("Progress reset.")
st.markdown("</div>", unsafe_allow_html=True)
