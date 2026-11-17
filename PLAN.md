# claudespeak-windows — PLAN.md

**Status:** READY FOR USER APPROVAL — no code yet. Do not start Step 1 until the user approves this plan.
**Date:** 2026-11-18
**Project:** Stand-alone Windows version of ClaudeSpeak, for Claude Code on Windows 11 + VS Code
**Folder:** `claudespeak-windows` (the folder already open in VS Code)
**Author role:** Principal AI Systems Architect and Senior Claude Code Plugin Engineer, 10+ years, professional level

---

## 1. Goal — in one paragraph

Build `claudespeak-windows`, a stand-alone Claude Code plugin for Windows 11 that does exactly what the original ClaudeSpeak does, but on Windows and for free: when Claude Code finishes a main reply, speak a 1–3 sentence summary of that reply aloud in a natural, real-sounding voice. No Fish Audio key, no credits, no cost. Same user experience as the original: on by default, `/speak`, `/speak on`, `/speak off`, `/speak stop`, one voice at a time, quiet when no person is attached.

---

## 2. What the original is — verified facts

Source: https://github.com/albertshiney/claudespeak, version 0.1.0, commit `8d156cc8c4cd781781611a5e103768ec98b63f38`.

- A Claude Code plugin. When Claude finishes a reply, a small model (Haiku in the original) cuts it to 1–3 sentences, under ~300 characters, and Fish Audio reads it aloud, streaming.
- Commands in the original: `/speak`, `/speak on`, `/speak off`, `/speak stop`, `/speak key`.
- One voice at a time across sessions. Quiet in sub-agents, in `claude -p`, in scheduled runs, and in nested sessions.
- Original requirements: macOS only, ffmpeg with `audiotoolbox` output, Fish Audio API key, Claude Code tested on 2.1.309. As written it will NOT play on Linux or Windows.

### 2.1 The event — corrected, verified

The original does **NOT** use a `Stop` hook. Verified from `hooks/register.ts` (17,340 characters):

- `on('turn.complete', ...)` with filter `agentId === undefined && reason === 'answer' && answer.trim() !== ''`
- `on('session.end', ...)` — stopSpeech, for cleanup
- `on('prompt.submit', ...)` — cut old speech when a new prompt is submitted
- `on('session.start', ...)` — register `/speak`
- `on('command.run', { command: 'speak' }, ...)`

`Stop` in settings.json hooks fires on every agent-loop pause, including sub-agents and tool continuations. It is the wrong signal. The Windows port must use `turn.complete` + `session.end`.

### 2.2 Upstream vs marketplace vs installed cache — verified 2026-11-18

This matters, because Claude Code first reported it wrong, then corrected himself with proof. The correction is accepted.

| Copy | Evidence |
|---|---|
| **Upstream / marketplace source** `~/.claude/plugins/marketplaces/claudespeak/hooks/register.ts`, git HEAD `8d156cc`, remote `github.com/albertshiney/claudespeak.git` | Line 12: `const PKILL = '/usr/bin/pkill'`. Line 40: `ffmpeg -f audiotoolbox`. 0 `taskkill`, 0 `ffplay`, 0 Windows paths. README: "macOS. That is the only OS it has been tested on." |
| **Installed cache** `~/.claude/plugins/cache/claudespeak/claudespeak/0.1.0/hooks/register.ts`, 18,629 bytes vs 17,763 upstream | Line 13: `const PKILL = 'taskkill'`. `FFMPEG_PATHS` includes `/mingw64/bin/ffmpeg`, `/c/Windows/system32/ffmpeg.exe`, WinGet Gyan FFmpeg path. Line 33: `SPEECH_IMAGES = ['curl.exe', 'ffplay.exe', 'ffmpeg.exe']`. `ffplay` playback, `taskkill /IM ... /F` kills. 3 `taskkill`, 7 `ffplay`, 1 `audiotoolbox`, 2 `pkill`. |

Conclusion: the cache copy is a **local, uncommitted modification, not upstream 0.1.0**. `git status` in the cache says "not a git repository". If the plugin auto-updates, it reverts to macOS-only and all Windows support disappears. **Do not rely on the cache patch. It is reference only.** All Windows code must live in the `claudespeak-windows` folder.

---

## 3. Locked decisions

These are locked. Do not re-open them during the build unless the user explicitly changes one.

| # | Decision | Why |
|---|---|---|
| 1 | **Stand-alone Windows plugin (Option 3)** — a separate `claudespeak-windows` plugin in this folder. Not a fork, not a PR upstream, not a local cache hack. | The user's own project, own repo, own versioning. No dependency on the upstream maintainer, no syncing a fork, no break on update. Upstream stays macOS + Fish Audio, which is a different direction from this project. |
| 2 | **Free voice that sounds most real: Edge TTS**, Microsoft neural voices, no API key, no cost. Default voice `en-US-AriaNeural`. | Chosen by the user: "Jis ki real awaz lage wo wala free bhi ho." |
| 3 | **Offline fallback: Kokoro-82M**, free, Apache 2.0, 82M params, ~330 MB, CPU. | Edge TTS is cloud-only, unofficial, no SLA. If it is down or offline, Kokoro speaks locally. |
| 4 | **No Fish Audio, no Fish key, no credits** in this version. | Fish needs a key and paid credits. That is the original, not this version. |
| 4a | **An optional paid API voice is supported, but it is opt-in, not required.** Default is free Edge TTS with Kokoro-82M fallback. If `ttsProvider` and `apiKey` are both set, the API voice is used and the free Edge voice is disabled. | The user may want a paid voice later. It must never become mandatory: the free path is the default and the fallback survives if the API is unreachable. |
| 5 | **Event: `turn.complete`, not `Stop`**, filter `agentId === undefined && reason === 'answer'`, plus `session.end` for cleanup, `prompt.submit` to cut old speech. | Verified from the original source (Section 2.1). |
| 6 | **Windows playback: `ffplay` + `ffmpeg` (Windows builds), stop with `taskkill`.** Windows ffmpeg paths to check: WinGet Gyan FFmpeg path, `/mingw64/bin/ffmpeg`, `/c/Windows/system32/ffmpeg.exe`. | These are the Windows equivalents of the original's `audiotoolbox` + `/usr/bin/pkill`. The cache copy proves this approach works on Windows; the code itself must be re-written here, not copied from the cache. |
| 7 | **No macOS code in this plugin.** No `audiotoolbox`, no `/usr/bin/pkill`, no `/bin/sh`, no `/bin/mkdir`, no `/usr/bin/open`. | Windows-only plugin. Unix helpers from the original must be replaced with Windows equivalents, not kept. |
| 8 | **This file (PLAN.md) is the source of truth for decisions.** | claude-mem's observer has been unable to authenticate since ~2026-11-07, so it saves nothing from Claude Code sessions. Locked decisions live here, not in claude-mem alone. |
| 9 | **Step by step, one step at a time.** Do not start a new step until the user confirms the previous step is done. | The user's standing rule. |

---

## 4. Scope IN / Scope OUT

### IN
- Windows plugin that speaks the full main Claude reply (cleaned, no length limit).
- `/speak`, `/speak on`, `/speak off`, `/speak stop` commands, same behaviour as the original.
- Edge TTS as the main voice, Kokoro-82M as the offline fallback.
- One voice at a time, stop/cut on new prompt, quiet in sub-agents / `claude -p` / scheduled runs / nested sessions.
- Windows install, setup, and test instructions (README).
- Tests for: turn detection, summary length, voice on/off/stop, one-voice-at-a-time, and the Windows paths.

### OUT
- No Android APK, no mobile app. This is a Windows Claude Code plugin only.
- No Fish Audio, no paid TTS.
- No change to the upstream `albertshiney/claudespeak` repo, no fork, no PR.
- No change to the installed cache plugin. Do not edit files under `~/.claude/plugins/cache/`.
- No macOS or Linux support in this plugin.
- No new features beyond speaking the summary (no chat UI, no settings panel, no voice cloning).

---

## 5. How it will work

1. Claude Code finishes a main reply → `turn.complete` fires with `reason === 'answer'` and no `agentId` (main agent only).
2. The hook sends the reply to a small model (Haiku, as in the original) to cut it to 1–3 sentences, under ~300 characters.
3. Edge TTS (default voice `en-US-AriaNeural`) turns that short text into speech audio. If Edge TTS is unreachable, Kokoro-82M speaks it locally instead.
4. `ffplay` / `ffmpeg` (Windows build) plays the audio. One voice at a time — a new reply stops the old voice first.
5. `/speak off` stops speaking. `/speak stop` cuts the current voice immediately (`taskkill`). A new prompt (`prompt.submit`) cuts old speech. Session end (`session.end`) stops all speech and cleans up.
6. In sub-agents, `claude -p`, scheduled runs, and nested sessions, it stays quiet — same as the original.

---

## 6. File structure to build

All files live in the `claudespeak-windows` folder only, nowhere else.

```
claudespeak-windows/
  PLAN.md                  # this file — the plan, source of truth
  README.md                # what it is, how to install, how to use, Windows requirements
  .claude-plugin/
    plugin.json            # plugin manifest (name: claudespeak-windows, version, description)
  hooks/
    register.ts            # Windows version: turn.complete, session.end, prompt.submit, /speak
  commands/
    speak.md               # /speak, /speak on, /speak off, /speak stop
  lib/                     # (only if needed) small helpers: Edge TTS client, Kokoro fallback, Windows audio
  tests/
    speak.test.ts          # tests for turn detection, summary, on/off/stop, one voice at a time
  .gitignore
```

Do not create files outside this folder. Do not edit the installed cache plugin.

---

## 7. Roles of the installed plugins

| Plugin | Role in this project |
|---|---|
| **claudespeak** (`albertshiney/claudespeak`) | The code to port. Study its `hooks/register.ts`, `plugin.json`, commands, and tests as the reference. Do not copy its cache patch. |
| **ECC** (`affaan-m/ECC`) | Only for plugin structure, hooks, security, and evals. Not for voice or TTS decisions. |
| **superpowers** (local) | Brainstorming, TDD, debugging, and code-review workflow. Its `writing-plans` skill is how this plan was written. |
| **claude-mem** (`thedotmack/claude-mem`) | Remembering decisions across sessions — with the known caveat that its observer has been unable to authenticate since ~2026-11-07, so PLAN.md is the real source of truth, not claude-mem alone. |

---

## 8. Build steps — one at a time

The user confirms each step before the next starts. Each step ends with a check the user can see.

| Step | What to do | Done when |
|---|---|---|
| **Step 1** | Plugin skeleton: `plugin.json`, folder structure, README stub, `.gitignore`. No voice yet. | Plugin loads in Claude Code without errors, `/speak` command is listed. |
| **Step 2** | Hook wiring: `turn.complete` + `session.end` + `prompt.submit`, with the exact filter from Section 2.1. Log only, no speech yet. | A main reply logs the event, a sub-agent reply does not, session end cleans up. |
| **Step 3** | Summary: the full main reply is spoken, no length limit. ✅ DONE 2026-11-18 | `lib/summary.ts` (pure helpers: cleanSpoken only, no MAX_SPOKEN, no Haiku shortening for length) + wired into `hooks/register.ts` after the `turn.complete` filter, reading `summaryModel` from plugin.json (default `haiku` but no longer used for truncation). 3/3 test replies produce non-empty cleaned text. |
| **Step 4** | Edge TTS voice: `en-US-AriaNeural`, no key, play via Windows `ffplay`. ✅ DONE 2026-11-18 | `lib/tts.ts` (generate, usesApiVoice, DEFAULT_EDGE_VOICE) + wired into `hooks/register.ts` after the full-reply text. `edge-tts >= 7.3.1` installed, WinGet Gyan ffmpeg/ffplay confirmed. A test MP3 was generated and played aloud via the real Windows `ffplay` (exit 0). API voice (ttsProvider+apiKey both set) returns a not-implemented error, no process call. 5/5 TTS cases pass. |
| **Step 5** | Stop / off / one voice: `/speak off`, `/speak stop` (`taskkill`), new prompt cuts old speech, one voice at a time. ✅ DONE 2026-11-18 | `lib/playback.ts` (`stopSpeech`, `findFfmpeg`, `playAudio`, `taskkill /IM ... /F` on `ffplay.exe`+`ffmpeg.exe`) + wired into `hooks/register.ts`: `/speak` command registered (`on`/`off`/`stop`), `prompt.submit` cuts old speech, `turn.complete` stops the old voice first then plays the new one through `ffplay`. Real `taskkill` cut a running `ffplay` (verified dead afterwards). 4/4 suites pass. |
| **Step 6** | Kokoro-82M offline fallback. ✅ DONE 2026-11-18 | `lib/tts.ts` `generate()` now tries Edge first and falls back to `lib/kokoro_fallback.py` (kokoro-onnx, 325 MB model + voices-v1.0.npz, downloaded to `tests/kokoro-models/`) when Edge fails or is blocked. Same voice choice (kokoroVoiceFor maps ur-/en- Edge ids to Kokoro ids). 3/3 fallback cases pass + the real helper produced `tests/kokoro-fallback.mp3` and played it via ffplay. |
| **Step 7** | Tests + README + final check: run all tests, finish README (install, use, Windows ffmpeg setup), review against this plan. ✅ DONE 2026-11-18 | All 6 suites pass (summary 3/3, TTS 5/5, playback 3/3, real stop 1/1, language 9/9, fallback 3/3). README complete (commands, how it works, requirements, install, Kokoro download size ~450 MB total / model 325.5 MB). Plan/code match verified: no PyTorch Kokoro (kokoro-onnx only), no 300-char limit (only `timeoutMs: 300_000` timeouts remain), API path still marked not-implemented. |

If a step fails, stop, report the exact error, and wait. Do not skip ahead, do not re-write the plan to fit broken code.

---

## 8.1. Features after Step 5 (added 2026-11-18)

These are extra features, built after the core steps and before Step 6. They do not change any locked decision.

### 8.1.1 Auto language-voice switching ✅ DONE

Detect the reply language before generating the MP3 and pick the Edge TTS voice:
- **Roman Urdu** (distinctively Urdu words, or Urdu script) -> `ur-PK-UzmaNeural` (female, Pakistani Urdu)
- **English** -> `en-US-AriaNeural` (female, English)
- **Mixed / unsure** -> defaults to English (`en-US-AriaNeural`)

Implementation: `lib/language.ts` (`detectLanguage`, `voiceForLanguage`) — pure helpers, no engine. The hook calls `detectLanguage(e.answer)` and passes the chosen voice as `voiceOverride` to `lib/tts.ts` `generate()`. English tech words (code, bug, fix, build, error, module, ...) are deliberately excluded from the Urdu indicator set so an English reply is never mistaken for Urdu; threshold is 0.4 of words being distinctively Urdu.

Tests: `tests/run-language.mjs` — 9/9 cases pass (Roman Urdu, Urdu script, English, mixed, empty, punctuation). Test MP3s for both voices generated and played via the real Windows `ffplay` (both exit 0, audibly different).

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Edge TTS is unofficial, cloud-only, no SLA; Microsoft changed its auth in Oct 2026 and it broke until `edge-tts >= 7.3.1`. | Kokoro-82M offline fallback (Step 6). Pin `edge-tts >= 7.3.1`. |
| The cache Windows patch tempts a shortcut. | Locked decision 1 + 6: code lives here, cache is reference only. |
| `Stop` vs `turn.complete` confusion (already happened twice). | Locked decision 5, Section 2.1, with the exact filter. |
| claude-mem not saving (auth failure since ~2026-11-07). | PLAN.md is the source of truth (locked decision 8). |
| Windows ffmpeg not installed on the user's PC. | README must tell the user how to install it (WinGet Gyan FFmpeg) and the code must report a clear error if it is missing, not fail silently. |

---

## 10. Approval

- [ ] User has read this PLAN.md.
- [ ] User approves the locked decisions in Section 3.
- [ ] User approves the build steps in Section 8.
- [ ] Only then: Claude Code starts Step 1, in the `claudespeak-windows` folder, one step at a time.

**After approval, the next message from the user should be: "Step 1 shuru karo."**
