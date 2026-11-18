#!/usr/bin/env python3
"""claudespeak-watcher — watches session .jsonl files for new replies and speaks them.

Watches ALL .jsonl files under ~/.claude/projects/ sorted by latest modified.
When a new main reply finishes, detects language and picks the voice:
  Roman Urdu -> ur-PK-UzmaNeural
  English    -> en-US-AriaNeural

Generates MP3 via edge-tts (offline fallback via Kokoro).
Plays via Windows ffplay.

One voice at a time: a new reply stops the old voice.
Stop with Ctrl+C.
"""
import json, os, re, subprocess, sys, time

# ---- language detection ----------------------------------------------------
_URDU_ROMANURDU_WORDS = frozenset({
    "main", "tum", "aap", "hum", "yeh", "woh", "ye", "wo",
    "iska", "iska", "iska", "iska", "iska", "iska", "iska", "iska",
    "main", "tum", "aap", "hum", "yeh", "woh", "ye", "wo",
    "b", "b", "b", "b", "b", "b", "b", "b", "b", "b",
    "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch", "kuch",
    "kaise", "kaise", "kaise", "kaise", "kaise", "kaise",
    "thoda", "thoda", "thora", "thora",
    "bahut", "bahut", "bahut",
    "ab", "ab", "ab",
    "sawan", "barish", "baarish",
    "par", "par", "par",
    "bro", "bro", "bro",
    "ji", "ji", "ji",
    "hi", "hello", "hey",
    "kya", "kya", "kya",
    "hai", "hai", "hai",
    "ho", "ho", "ho",
    "haan", "haan", "haan",
    "nahi", "nahi", "nahi",
})

_URDU_SCRIPT_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")


def detect_language(text: str) -> str:
    if not text:
        return "english"
    if _URDU_SCRIPT_RE.search(text):
        return "urdu"
    words = [w.lower().strip(".,;:!?\"'°°¤«»–—–") for w in text.split() if len(w) >= 2]
    urdu_cnt = sum(1 for w in words if w in _URDU_ROMANURDU_WORDS)
    total = len(words)
    if total > 0 and urdu_cnt / total >= 0.15:
        return "urdu"
    return "english"


def roman_urdu_to_urdu(text: str) -> str:
    """Transliterate Roman Urdu to Urdu script for proper TTS pronunciation."""
    # Common Roman Urdu to Urdu script mappings
    roman_to_urdu = {
        "main": "میں",
        "tum": "تم",
        "aap": "آپ",
        "hum": "ہم",
        "yeh": "یہ",
        "woh": "وہ",
        "ye": "یہ",
        "wo": "وہ",
        "iska": "اس کا",
        "mera": "میرا",
        "tera": "تیرا",
        "humara": "ہمارا",
        "tumhara": "تمہارا",
        "unka": "انکا",
        "inko": "انکو",
        "unko": "انکو",
        "isko": "اسکو",
        "usko": "اسکو",
        "hai": "ہے",
        "hain": "ہیں",
        "tha": "تھا",
        "thi": "تھی",
        "the": "تھے",
        "hoga": "ہوگا",
        "hoge": "ہونگے",
        "kar": "کر",
        "karna": "کرنا",
        "kiya": "کیا",
        "kiye": "کئے",
        "karta": "کرتا",
        "karte": "کرتے",
        "karti": "کرتی",
        "ho": "ہو",
        "hona": "ہونا",
        "hu": "ہوں",
        "hun": "ہوں",
        "kuch": "کچھ",
        "kya": "کیا",
        "kyun": "کیوں",
        "kaise": "کیسے",
        "kahan": "کہاں",
        "kab": "کب",
        "kaun": "کون",
        "kitna": "کتنا",
        "kitni": "کتنی",
        "aur": "اور",
        "lekin": "لیکن",
        "magar": "مگر",
        "par": "پر",
        "to": "تو",
        "toh": "تو",
        "agar": "اگر",
        "phir": "پھر",
        "abhi": "ابھی",
        "ab": "اب",
        "tab": "تب",
        "jab": "جب",
        "jaise": "جیسے",
        "wese": "ویسے",
        "aise": "ایسے",
        "waise": "ويسے",
        "zyada": "زیادہ",
        "kam": "کم",
        "bohot": "بہت",
        "bahut": "بہت",
        "thora": "تھوڑا",
        "thodi": "تھوڑی",
        "bas": "بس",
        "hi": "ہی",
        "bhi": "بھی",
        "nahi": "نہیں",
        "nahin": "نہیں",
        "na": "نہ",
        "ji": "جی",
        "han": "ہاں",
        "haan": "ہاں",
        "ok": "اوکے",
        "theek": "ٹھیک",
        "sahi": "سہی",
        "galat": "غلط",
        "baat": "بات",
        "kaam": "کام",
        "waqt": "وقت",
        "din": "دن",
        "raat": "رات",
        "subah": "صبح",
        "sham": "شام",
        "kal": "کل",
        "aaj": "آج",
        "pars": "پرسن",
        "ghar": "گھر",
        "bahar": "باہر",
        "andar": "اندر",
        "upar": "اوپر",
        "neeche": "نیچے",
        "paas": "پاس",
        "door": "دور",
        "saath": "ساتھ",
        "bina": "بنا",
        "pani": "پانی",
        "khana": "کھانا",
        "chai": "چائے",
        "coffee": "کافی",
        "gadi": "گاڑی",
        "car": "کار",
        "bike": "بائیک",
        "bus": "بس",
        "train": "ٹرن",
        "dost": "دوست",
        "dosts": "دوستوں",
        "family": "فملی",
        "maa": "ماں",
        "baap": "باپ",
        "bhai": "بھائی",
        "behen": "بہن",
        "beta": "بیٹا",
        "beti": "بیٹی",
        "paisa": "پیسہ",
        "rupee": "روپے",
        "note": "نوٹ",
        "coin": "سکہ",
        "bank": "بینک",
        "atm": "اے ٹی ایم",
        "card": "کارڈ",
        "cash": "کیش",
        "kuch": "کچھ",
        "b": "ب",
        "kya": "کیا",
        "kyun": "کیوں",
        "kaise": "کیسے",
        "thoda": "تھوڑا",
        "thora": "تھوڑا",
        "bahut": "بہت",
        "bohot": "بہت",
        "ab": "اب",
        "tab": "تب",
        "jab": "جب",
        "jaise": "جیسے",
        "waise": "ويسے",
        "zyada": "زیادہ",
        "kam": "کم",
        "sawan": "ساون",
        "barish": "بارش",
        "baarish": "بارش",
        "par": "پر",
        "bahut": "بہت",
        "bohot": "بہت",
        "rubaru": "رُبرو",
        "raaz": "راز",
        "pyaar": "پیار",
        "dosti": "دوستی",
        "sach": "سچ",
        "jhooth": "جھوٹ",
        "maaf": "معاف",
        "shukriya": "شکریہ",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
        "iska": "اس کا",
    }

    # Apply transliteration
    result = text
    for roman, urdu in sorted(roman_to_urdu.items(), key=lambda x: -len(x[0])):
        result = re.sub(r'\b' + re.escape(roman) + r'\b', urdu, result, flags=re.IGNORECASE)
    return result


def should_transliterate(text: str) -> bool:
    """Check if text is Roman Urdu that needs transliteration."""
    if not text:
        return False
    lang = detect_language(text)
    return lang == "urdu"


def voice_for_language(lang: str) -> str:
    return "ur-PK-AsadNeural" if lang == "urdu" else "en-US-AriaNeural"


def run_edge_tts(text: str, voice: str, out_mp3: str) -> bool:
    """Run edge-tts with retry logic for sandbox issues."""
    edge_tts_args = ["edge-tts", "-v", voice, "--write-media", out_mp3, "-t", text]
    for attempt in range(5):
        print(f"[debug] running edge-tts (attempt {attempt+1}): {' '.join(edge_tts_args)}", flush=True)
        try:
            edge_proc = subprocess.run(edge_tts_args, timeout=300, capture_output=True)
            if edge_proc.returncode == 0 and os.path.exists(out_mp3) and os.path.getsize(out_mp3) > 0:
                print(f"[debug] edge-tts exit=0, file_size={os.path.getsize(out_mp3)}", flush=True)
                return True
            stderr_msg = edge_proc.stderr.decode() if edge_proc.stderr else "no stderr"
            print(f"[debug] edge-tts attempt {attempt+1} failed (exit {edge_proc.returncode}): {stderr_msg[:200]}", file=sys.stderr, flush=True)
            time.sleep(1 * (attempt + 1))
        except Exception as e:
            print(f"[debug] edge-tts attempt {attempt+1} exception: {e}", file=sys.stderr, flush=True)
            time.sleep(1 * (attempt + 1))
    return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="claudespeak watcher")
    parser.add_argument("--session", default=None, help="Path to .jsonl session file")
    args = parser.parse_args()

    work_dir = os.path.dirname(os.path.abspath(__file__))
    out_mp3 = os.path.join(work_dir, "tests", "last-reply.mp3")

    print("watcher starting", flush=True)

    _last_text = None

    while True:
        try:
            # Find ALL .jsonl files under ~/.claude/projects/ sorted by mtime
            base = os.path.expanduser("~/.claude/projects")
            candidates = []
            for d in os.listdir(base):
                p = os.path.join(base, d)
                if os.path.isdir(p):
                    for f in os.listdir(p):
                        if f.endswith(".jsonl"):
                            candidates.append(os.path.join(p, f))
            if not candidates:
                time.sleep(1)
                continue
            candidates.sort(key=lambda p: os.path.getmtime(p))
            session_path = candidates[-1]

            print(f"[watcher] starting — watching: {session_path}", flush=True)
        except Exception as e:
            print(f"[error] finding session: {e}", file=sys.stderr)
            time.sleep(1)
            continue

        # Read the latest session .jsonl
        try:
            with open(session_path, "r", encoding="utf-8") as sf:
                lines = sf.readlines()
        except Exception as e:
            print(f"[error] reading session: {e}", file=sys.stderr)
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
                # Check for assistant message: type="assistant" at top level
                if ev.get("type") == "assistant":
                    message = ev.get("message", {})
                    if isinstance(message, dict) and message.get("role") == "assistant":
                        content = message.get("content", [])
                        if isinstance(content, list):
                            txt_parts = []
                            for item in content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    txt_parts.append(item.get("text", ""))
                            txt = " ".join(txt_parts)
                        else:
                            txt = str(content)
                        txt = re.sub(r"\*\*.*?\*\*", "", txt)
                        txt = re.sub(r"\n+", " ", txt).strip()
                        if txt:
                            last_text = txt
                            break
            except (json.JSONDecodeError, KeyError):
                continue

        print(f"[check] checking (len={len(last_text) if last_text else 0})", flush=True)

        if not last_text:
            time.sleep(1)
            continue

        # Debounce: only process if text changed
        if last_text == getattr(_last_text, "strip", lambda: None) and _last_text:
            time.sleep(1)
            continue
        _last_text = last_text

        print(f"[new reply] {last_text[:50]}...", flush=True)

        lang = detect_language(last_text)
        voice = voice_for_language(lang)

        # If Urdu detected, transliterate Roman Urdu to Urdu script for proper TTS
        tts_text = last_text
        if lang == "urdu":
            tts_text = roman_urdu_to_urdu(last_text)
            print(f"[transliterate] Roman Urdu -> Urdu script: {tts_text[:50]}...", flush=True)

        # Generate MP3 via edge-tts with retry
        out_mp3 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests", "last-reply.mp3")
        if not run_edge_tts(tts_text, voice_for_language(lang), out_mp3):
            print("[error] edge-tts failed after retries", file=sys.stderr)
            time.sleep(1)
            continue

        print(f"[tts] RESULT ok=true provider=edge voice={voice_for_language(lang)} text_len={len(last_text)}", flush=True)

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

        print("[voice] playing", flush=True)
        try:
            proc.wait(timeout=300)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()

        print(f"[voice] finished", flush=True)

        time.sleep(1)


if __name__ == "__main__":
    main()