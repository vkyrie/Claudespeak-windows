---
description: Control whether finished replies are spoken aloud
---

# /speak

`/speak`, `/speak on`, `/speak off`, `/speak stop`, `/speak key`

Control whether `claudespeak-windows` speaks a 1–3 sentence summary of each finished Claude Code reply aloud.

## Behaviour

- **`/speak`** — Toggle speaking on or off. If speaking is on, turn it off; if off, turn it on. Report the new state.
- **`/speak on`** — Start speaking summaries. Idempotent: if already on, say so.
- **`/speak off`** — Stop speaking summaries. Idempotent: if already off, say so.
- **`/speak stop`** — Cut the current voice immediately (kill the playback process) without changing the on/off setting.
- **`/speak key`** — Set or view the API key for the chosen TTS provider. Opens the config where you paste the key. Never commit it.

## Rules

- Speaking is **on by default**.
- Only the **main agent** speaks. Sub-agents, `claude -p`, scheduled runs, and nested sessions stay quiet.
- **One voice at a time**: a new finished reply stops any currently-playing voice before starting the new one.
- A new submitted prompt (`prompt.submit`) cuts any currently-playing voice.
- Session end (`session.end`) stops all speech and cleans up.
- **Voice selection:**
  - If `ttsProvider` and `apiKey` are **both set**, the chosen paid API voice is used and the free Edge TTS voice is **disabled**.
  - If `ttsProvider` is **not set** (or `edge` with no key), free Edge TTS `en-US-AriaNeural` is used, with Kokoro-82M as the offline fallback.
  - No Fish Audio, no credits in this version.

## Notes

- This file only defines the command interface. The actual speaking is wired by `hooks/register.ts` in a later step.
- If ffmpeg or the TTS backend is missing, report a clear error instead of failing silently.