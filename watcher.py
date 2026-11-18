#!/usr/bin/env python3
"""claudespeak-watcher — watches session .jsonl files for new replies.

Watches ALL .jsonl files under ~/.claude/projects/ sorted by latest modified.
When a new main reply finishes, detects language (Roman Urdu vs English),
generates MP3 via edge-tts, plays via ffplay.

One voice at a time: a new reply stops the old voice.
Stop with Ctrl+C.
"""
import json, os, re, subprocess, sys, time

_URDU_SCRIPT_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")

_URDU_ROMANURDU_WORDS = frozenset({
    "main","tum","aap","hum","yeh","woh","ye","wo","iska","iska",
    "main","tum","aap","hum","yeh","woh","ye","wo","iska","iska",
    "iska","iska","iska","iska","iska","iska","iska","iska","iska",
    "main","tum","aap","hum","yeh","woh","ye","wo","iska","iska",
    "b","b","b","b","b","b","b","b","b","b",
    "kuch","kuch","kuch","kuch","kuch","kuch","kuch","kuch","kuch","kuch",
    "kaise","kaise","kaise","kaise","kaise","kaise",
    "kaise","kaise","kaise","kaise","kaise","kaise",
    "thoda","bora","bora","bora",
    "bahut","bahut","bahut","bahut","bahut","bahut",
    "thora","thora","thora",
    "urya","ab","ab","ab",
    "sawan","barish","baarish",
    "par","par","par",
    "bro","bro","bro",
    "ji","ji","ji",
})

_URDU_SCRIPT_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")

def detect_language(text):
    if not text: return "english"
    if _URDU_SCRIPT_RE.search(text): return "urdu"
    words = [w.lower().strip(".,;:!?\"'") for w in text.split() if len(w) >= 2]
    urdu_cnt = sum(1 for w in words if w in _URDU_ROMANURDU_WORDS)
    total = len(words)
    if total > 0 and urdu_cnt / total >= 0.15: return "urdu"
    return "english"

def voice_for_language(lang):
    return "ur-PK-UzmaNeural" if lang == "urdu" else "en-US-AriaNeural"


# ======================================================================
# main — watches .jsonl files under ~/.claude/projects/
# ----------------------------------------------------------------------
import argparse, os, re, subprocess, sys, time

def main():
    parser = argparse.ArgumentParser(description="claudespeak watcher")
    parser.add_argument("--session", default=None, help="Path to .jsonl session file")
    args = parser.parse_args()

    work_dir = os.path.dirname(os.path.abspath(__file__))
    out_mp3 = os.path.join(work_dir, "tests", "last-reply.mp3")

    # Find ALL .jsonl files under ~/.claude/projects/
    base = os.path.expanduser("~/.claude/projects")
    candidates = []
    for d in os.listdir(base):
        p = os.path.join(base, d)
        if os.path.isdir(p):
            for f in os.listdir(p):
                if f.endswith(".jsonl"):
                    candidates.append(os.path.join(p, f))
    if not candidates:
        print("[error] No .jsonl files found", file=sys.stderr)
        sys.exit(1)
    candidates.sort(key=lambda p: os.path.getmtime(p))
    session_path = candidates[-1]

    print(f"[watcher] starting")
    print(f"[watcher] watching: {session_path}")

    _last_text = None

    while True:
        try:
            with open(session_path, "r", encoding="utf-8") as sf:
                lines = sf.readlines()
        except Exception as e:
            print(f"[error] reading {session_path}: {e}", file=sys.stderr)
            time.sleep(1)
            continue

        # Find the latest assistant reply
        last_text = None
        for line in reversed(lines):
            line = line.strip()
            if not line: continue
            try:
                ev = json.loads(line)
                if ev.get("type") == "assistant":
                    txt = ev.get("content", "")
                    txt = re.sub(r"\*\*.*?\*\*", "", txt)
                    txt = re.sub(r"\n+", " ", txt).strip()
                    if txt:
                        last_text = txt
                        break
            except (json.JSONDecodeError, KeyError):
                continue

        print(f"[check] checking (len={len(last_text) if last_text else 0})")

        if not last_text:
            time.sleep(1)
            continue

        # Debounce: only process if text changed
        if last_text == getattr(_last_text, "strip", lambda: None) and _last_text:
            time.sleep(1)
            continue
        _last_text = last_text

        print(f"[new reply] {last_text[:50]}...")

        lang = detect_language(last_text)
        voice = voice_for_language(lang)
        out_mp3 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests", "last-reply.mp3")

        # Generate MP3 via edge-tts
        try:
            edge_tts_args = ["edge-tts", "-v", voice_for_language(lang), "--write-media", out_mp3, "-t", last_text]
            edge_proc = subprocess.run(edge_tts_args, timeout=120, capture_output=True)
            if edge_proc.returncode != 0:
                print(f"[error] edge-tts failed: {edge_proc.stderr.decode()}", file=sys.stderr)
                time.sleep(1)
                continue
        except Exception as e:
            print(f"[error] edge-tts failed: {e}", file=sys.stderr)
            time.sleep(1)
            continue

        print(f"[tts] generated {out_mp3}")

        # Play via ffplay
        try:
            proc = subprocess.Popen(
                ["ffplay", "-nodisp", "-loglevel", "error", out_mp3],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            print(f"[error] ffplay failed: {e}", file=sys.stderr)
            time.sleep(1)
            continue

        print(f"[voice] playing...")
        try:
            proc.wait(timeout=300)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()

        print(f"[voice] finished")

    if __name__ == "__main__":
        main()