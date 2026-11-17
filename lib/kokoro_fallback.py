#!/usr/bin/env python3
"""Kokoro-82M offline TTS fallback for claudespeak-windows.

Called by lib/tts.ts generate() when Edge TTS fails or is blocked.
Runs locally — no internet needed after the model is downloaded once.

Usage:
  python kokoro_fallback.py --model PATH --voice PATH --out OUT.mp3 \
      --text "text to speak" --voice-id af_sarah [--lang en-us] [--speed 1.0]

Exit code 0 and the file written on success; non-zero on failure (message on stderr).

The voices file is the official kokoro-onnx voices-v1.0.npz bundle (a numpy
archive keyed by voice id, e.g. af_sarah). The library loads it with np.load()
and looks the voice id up at inference time, so --voice is the .npz path and
--voice-id is the id inside it.
"""
import argparse
import os
import subprocess
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Kokoro-82M offline TTS fallback")
    parser.add_argument("--model", required=True, help="Path to the Kokoro ONNX model")
    parser.add_argument("--voice", required=True, help="Path to the voices .npz bundle")
    parser.add_argument("--out", required=True, help="Output MP3 path")
    parser.add_argument("--text", required=True, help="Text to speak")
    parser.add_argument("--voice-id", default="af_sarah", help="Voice id inside the bundle (default: af_sarah)")
    parser.add_argument("--lang", default="en-us", help="Language code (default: en-us)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed (default: 1.0)")
    args = parser.parse_args()

    try:
        import soundfile as sf
        from kokoro_onnx import Kokoro
    except ImportError as e:
        print(f"kokoro-onnx not installed: {e}", file=sys.stderr)
        print("Install with: pip install kokoro-onnx espeakng-loader phonemizer soundfile", file=sys.stderr)
        return 1

    try:
        kokoro = Kokoro(args.model, args.voice)
        audio, sample_rate = kokoro.create(args.text, voice=args.voice_id, speed=args.speed, lang=args.lang)
    except Exception as e:
        print(f"Kokoro inference failed: {e}", file=sys.stderr)
        return 1

    # Write a WAV first, then encode to MP3 with ffmpeg so the output matches
    # what Edge TTS produces (the hook plays the same path either way).
    wav_path = args.out + ".wav"
    sf.write(wav_path, audio, sample_rate)

    ffmpeg = os.environ.get("FFMPEG_PATH", "ffmpeg")
    proc = subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "64k", args.out],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(f"ffmpeg encode failed: {proc.stderr}", file=sys.stderr)
        return 1
    try:
        os.remove(wav_path)
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())