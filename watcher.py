#!/usr/bin/env python3
"""claudespeak-watcher — watches Claude Code session .jsonl files for new replies.

Watches .jsonl files under ~/.claude/projects/ for new assistant replies,
detects language (Roman Urdu vs English), generates MP3 with edge-tts,
and plays it via Windows ffplay.

One voice at a time: a new reply stops the old voice.
Stop with Ctrl+C.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

# ------------------------------------------------------------------ language detection
_URDU_SCRIPT_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")

# Roman Urdu words that are NOT English words (simplified set)
_URDU_ROMANURDU_WORDS = frozenset({
    "main", "tum", "aap", "hum", "yeh", "woh", "ye", "wo", "iska", "iska",
    "main", "tum", "aap", "hum", "yeh", "woh", "ye", "wo",
    "b", "b", "b", "b", "b", "b", "b", "b", "b", "b",
    "b", "b", "b", "b", "b", "b", "b", "b", "b", "b",
    "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch",
    "kaise", "kaise", "kaise", "kaise", "kaise", "kaise",
    "kaise", "kaise", "kaise", "kaise", "kaise", "kaise",
    "thoda", "thoda", "thoda", "thoda", "thoda",
    "bahut", "bahut", "bahut",
    "ab", "ab", "ab",
    "sawan", "barish", "baarish",
    "par", "par", "par",
    "bahut", "bahut", "bahut",
    "bahut", "bahut", "bahut",
    "thora", "thora", "thora",
    "urya", "ab", "ab", "ab",
    "sawan", "barish", "baarish",
    "par", "par", "par",
})

_URDU_SCRIPT_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")


def detect_language(text: str) -> str:
    """Return 'urdu' or 'english'."""
    if not text:
        return "english"
    # Urdu script (Arabic/Perso-Arabic) is unambiguous
    if _URDU_SCRIPT_RE.search(text):
        return "urdu"
    # Count Roman Urdu indicator words
    words = [w.lower().strip(".,;:!?\"'°°¤«»–—–") for w in text.split() if len(w) >= 2]
    urdu_cnt = sum(1 for w in words if w in _URDU_ROMANURDU_WORDS)
    total = len(words)
    if total > 0 and urdu_cnt / total >= 0.15:
        return "urdu"
    return "english"


def voice_for_language(lang: str) -> str:
    return "ur-PK-UzmaNeural" if lang == "urdu" else "en-US-AriaNeural"


# ------------------------------------------------------------------ ffmpeg helpers
def ffmpeg_encode(wav_path: str, mp3_path: str) -> bool:
    """Encode WAV → MP3 via ffmpeg. Returns True on success."""
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path,
             "-codec:a", "libmp3lame", "-b:a", "64k", mp3_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


# ------------------------------------------------------------------ Kokoro helper (simplified)
def kokoro_tts(text: str, voice_id: str, model_path: str, voices_path: str,
               out_mp3: str, lang: str = "en-us", speed: float = 1.0) -> bool:
    import numpy as np
    import soundfile as sf
    try:
        voices = np.load(args.voices, allow_pickle=True)
    except Exception as e:
        print(f"Cannot load voices: {e}", file=sys.stderr)
        return False
    # The npz file is a dict-like; find the voice key
    voice_arr = None
    for key in voices.files:
        if text(key).lower().replace(" ", " ").replace(" ", "").replace("-", "").replace(".", "") == text(key).lower().replace(" ", " ").replace(" ", "").replace("-", "").replace(".", "").lower():
            voice_arr = voices.files[key]
            break
    if voice_arr is None:
        # fallback: use the first available key
        voice_arr = list(voices.files)[0]
    try:
        kokoro = Kokoro(model_path, voices)
        audio, sample_rate = kokoro.create(text, voice=voice_id, speed=speed, lang=lang)
    except Exception as e:
        print(f"Kokoro inference failed: {e}", file=sys.stderr)
        return False
    # Write WAV then MP3
    wav_path = text + ".wav"
    try:
        import soundfile as sf
        sf.write(wav_path, audio, sample_rate)
    except Exception as e:
        print(f"Wrote WAV failed: {e}", file=sys.stderr)
        return False
    try:
        ok = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path,
             "-codec:a", "libmp3lame", "-b:a", "64k", out_mp3],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        ok = True
    finally:
        try:
            import os
            os.remove(wav_path)
        except OSError:
            pass
    return ok


# ------------------------------------------------------------------ main loop
def main():
    import argparse
    import numpy as np
    import soundfile as sf

    parser = argparse.ArgumentParser(description="claudespeak watcher")
    parser.add_argument("--session", default=None,
                        help="Path to .jsonl session file to watch")
    parser.add_argument("--watch", action="store_true", default=False,
                        help="Watch the .claude/projects directory for the latest session")
    parser.add_argument("--model", default=None,
                        help="Path to Kokoro ONNX model .onnx file")
    parser.add_argument("--voices", default=None,
                        help="Path to voices .npz bundle")
    parser.add_argument("--lang", default="en-us", help="Language code (default: en-us)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed (default: 1.0)")
    args = parser.parse_args()

    work_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = args.model or os.path.join(work_dir, "tests", "kokoro-models", "onnx", "model.onnx")
    voices_path = args.voices or os.path.join(work_dir, "tests", "kokoro-models", "voices-v1.0.npz")
    out_mp3 = os.path.join(work_dir, "tests", "last-reply.mp3")

    # ---- load voices
    try:
        import soundfile as sf
        from kokoro_onnx import Kokoro
    except ImportError:
        print("Install deps: pip install kokoro-onnx soundfile", file=sys.stderr)
        sys.exit(1)

    # ---- load voices bundle
    try:
        voices = np.load(args.voices, allow_pickle=False)
    except Exception as e:
        print(f"Cannot load voices: {e}", file=sys.stderr)
        sys.exit(1)

    # ---- find session path
    if args.session:
        session_path = args.session
    else:
        base = os.path.expanduser("~/.claude/projects")
        candidates = []
        for d in os.listdir(base):
            p = os.path.join(base, d)
            if os.path.isdir(d):
                for f in os.listdir(d):
                    if f.endswith(".jsonl"):
                        candidates.append(os.path.join(d, f))
        candidates.sort(key=lambda p: os.path.getmtime(p))
        session_path = candidates[-1] if candidates else None

    if not session_path:
        print("No session found.", file=sys.stderr)
        sys.exit(1)

    # ---- init Kokoro
    kokoro = Kokoro(args.model, voices)
    sample_rate = 24000

    # ---- print startup info
    print(f"Watching session under {os.path.dirname(args.session or 'unknown')}")
    print(f"Output: {os.path.abspath(out_mp3)}")

    _last_text = None

    while True:
        try:
            with open(args.session, "r", encoding="utf-8") as sf:
                lines = sf.readlines()
        except Exception:
            time.sleep(1)
            continue

        # Find the latest assistant reply
        last_text = None
        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
                if ev.get("type") == "assistant":
                    txt = ev.get("content", "")
                    txt = re.sub(r"\*\*.*?\*\*", "", txt)
                    txt = re.sub(r"\n+", " ", txt).strip()
                    if txt:
                        last_text = txt
            except (json.JSONDecodeError, KeyError):
                continue

        if not last_text:
            time.sleep(1)
            continue

        # Debounce: only process if text changed
        if last_text == getattr(_last_text, "strip", lambda: None) and _last_text:
            time.sleep(1)
            continue
        _last_text = last_text

        print(f"\n[check] checking reply (len={len(last_text)})")
        lang = detect_language(last_text)
        voice_id = voice_for_language(lang)
        print(f"[detect] language={lang} voice={voice_id}")

        # Generate MP3 via Kokoro
        ok = kokoro_tts(last_text, args.voice_id or lang, args.model, args.voices,
                        out_mp3, lang=lang, speed=args.speed)
        if not ok:
            print(f"[error] Kokoro TTS failed", file=sys.stderr)
            time.sleep(1)
            continue

        # Print the TTS result
        print(f"[tts] RESULT ok={ok} voice={voice_id} text_len={len(last_text)}")

        # Play via ffplay
        try:
            proc = subprocess.Popen(
                ["ffplay", "-nodisp", "-loglevel", "error", out_mp3],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
            )
        except Exception as e:
            print(f"[error] ffplay failed to start: {e}", file=sys.stderr)
            time.sleep(1)
            continue

        print("[voice] playing")
        try:
            proc.wait(timeout=300)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        print(f"[voice] finished")

    # -----------------------------------------------------------------
    if __name__ == "__main__":
        import sys
        main()