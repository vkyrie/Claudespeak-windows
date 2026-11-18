# claudespeak-windows

A stand-alone Windows version of [ClaudeSpeak](https://github.com/albertshiney/claudespeak) for **Claude Code on Windows 11 + VS Code**.

When Claude Code finishes a main reply, this plugin **reads the full reply aloud** in a natural, real-sounding voice — for free, with no Fish Audio key and no credits.

**Voice:** Edge TTS (`en-US-AriaNeural`) for English, `ur-PK-AsadNeural` (male) for Roman Urdu, with a Kokoro-82M offline fallback. Auto language switching: Roman Urdu → `ur-PK-AsadNeural` (male), English → `en-US-AriaNeural`.

---

## How Voice Works (Two Ways)

There are **two ways** to get voice output:

### 1. Plugin Hook (automatic, runs inside Claude Code)
When Claude Code finishes a main reply, the hook fires, detects language, and speaks via Edge TTS / ffplay.
- Automatic, runs inside Claude Code session
- Configured via `/speak on|off|stop|key` commands
- Configured via `settings.json` (enabledPlugins)

### 2. External Watcher (manual, runs outside Claude Code) **Recommended**
Runs as a separate Python process that watches the session `.jsonl` file for new assistant replies.
- Runs outside Claude Code sandbox → no Edge TTS sandbox issues
- More reliable, works even when plugin hook has issues
- **Recommended for daily use**

#### Watcher Commands
```bash
# Run in a terminal
python watcher.py

# Or use the batch file (double-click to run)
watcher.bat

# Or with specific session
python watcher.py --session path/to/session.jsonl
```

#### Auto-start on Windows (Startup folder)
1. Press `Win+R`, type `shell:startup`, press Enter
3. Create a shortcut to `watcher.bat` in the Startup folder
4. The watcher will auto-start on Windows login

---

## Commands (Plugin Hook)

| Command | What it does |
|---|---|
| `/speak` | Toggle speaking on/off |
| `/speak on` | Start speaking replies |
| `/speak off` | Stop speaking replies |
| `/speak stop` | Cut the current voice immediately |
| `/speak key` | Set or view the API key for the chosen TTS provider (optional) |

---

## How It Works (Plugin Hook)

1. Claude Code finishes a main reply → `turn.complete` fires.
2. The **full reply** is cleaned for speech (no markdown, code, paths, URLs, lists).
3. The reply's language is detected and the voice is picked:
   - Roman Urdu → `ur-PK-AsadNeural` (male, Pakistani Urdu)
   - English → `en-US-AriaNeural`
   - Mixed/unsure → English
4. Edge TTS (no key needed) turns it into an MP3. If `ttsProvider` + `apiKey` are both set, the API voice is used instead (not yet implemented). If Edge TTS is unreachable, Kokoro-82M speaks locally.
5. `ffplay` (Windows build) plays the audio. One voice at a time.

---

## Requirements

- Windows 11
- Claude Code on Windows + VS Code
- ffmpeg (Windows build) with `ffplay` — install via `winget install Gyan.FFmpeg` or from https://ffmpeg.org/download.html
- Python 3.10+ with `edge-tts >= 7.3.1` — `pip install "edge-tts>=7.3.1"`
- Kokoro-82M fallback (optional): `pip install kokoro-onnx espeakng-loader phonemizer soundfile`, plus the model download below

---

## Install

1. Open this folder (`claudespeak-windows`) in VS Code.
2. In Claude Code, go to **Settings → Plugins → Directory**, add this folder path, then enable the plugin.
   - **Note:** `/plugin install` command errors with "Unknown skill: plugin" — use Settings → Plugins → Directory instead.
3. Install ffmpeg and `edge-tts` as above.
4. Run `/speak on` to enable voice via the plugin hook.

---

## Voices Used

| Language | Voice | Description |
|---|---|---|
| English | `en-US-AriaNeural` | Female, US English |
| Roman Urdu | `ur-PK-AsadNeural` | Male, Pakistani Urdu (more natural) |
| Auto-detect | Auto | Mixed/unsure → English |

---

## Kokoro-82M Offline Fallback

The local fallback needs the model downloaded once — about **450 MB total** (the ONNX model is 325.5 MB, plus the voices bundle). It runs on CPU with no internet after that.

```
python lib/kokoro_fallback.py --model tests/kokoro-models/onnx/model.onnx \
  --voice tests/kokoro-models/voices-v1.0.bin --out out.mp3 \
  --text "text to speak" --voice-id af_sarah --lang en-us
```

The model and voices bundle come from `onnx-community/Kokoro-82M-v1.0-ONNX` and the `kokoro-onnx` GitHub release.

---

## Status

All build steps complete and tested. The hook cleans the full main reply, detects the language, and plays it: Edge TTS first, Kokoro-82M locally when Edge fails or is blocked. `stopSpeech()` cuts the current voice with `taskkill /IM ffplay.exe /F` (and `ffmpeg.exe`); `/speak off` stays quiet, `/speak stop` cuts immediately, a new reply stops the old voice first.

Run the checks: `node tests/run-summary.mjs`, `node tests/run-tts.mjs`, `node tests/run-playback.mjs`, `node tests/stop-real.mjs`, `node tests/run-language.mjs`, `node tests/run-fallback.mjs` from this folder.