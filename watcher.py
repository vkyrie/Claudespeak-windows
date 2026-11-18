#!/usr/bin/env python3
"""Simple watcher that prints check lines every second."""
import sys, time, os, json, re

def detect_language(text):
    if not text: return "english"
    if __import__("re").search(r"[؀-ۿ]", text): return "urdu"
    words = [w.lower() for w in text.split() if len(w) >= 2]
    urdu_words = {"main","tum","aap","hum","yeh","woh","ye","wo","iska","iska","iska","iska","iska","main","tum","aap","iska","iska","iska","iska","main","tum","aap","iska","iska","iska","iska"}
    total = sum(1 for w in words if len(w) >= 2)
    urdu_cnt = sum(1 for w in words if w in {"main","tum","aap","hum","yeh","woh","ye","wo","iska","iska","iska","iska","main","tum","aap","iska","iska","iska","iska"})
    return "urdu" if len(words) > 0 and urdu_cnt / total >= 0.15 else "english"

def voice_for_language(lang):
    return "ur-PK-UzmaNeural" if lang == "urdu" else "en-US-AriaNeural"

while True:
    print("[check]", flush=True)
    time.sleep(1)