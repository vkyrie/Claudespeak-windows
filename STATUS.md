# claudespeak-windows — STATUS

**Repo:** https://github.com/vkyrie/Claudespeak-windows
**Version:** 0.2.0
**Last updated:** 2026-11-18

---

## What this plugin is

A stand-alone Windows Claude Code plugin. When Claude Code finishes a main reply, it speaks that reply aloud in a natural voice — for free, no Fish Audio key, no credits.

**Voice:** Edge TTS (`en-US-AriaNeural`) for English, `ur-PK-AsadNeural` (male) for Roman Urdu, with a Kokoro-82M offline fallback. Auto language switching: Roman Urdu → `ur-PK-AsadNeural` (male), English → `en-US-AriaNeural` (female).

**Commands:** `/speak` (toggle), `/speak on`, `/speak off`, `/speak stop`, `/speak key`.

---

## Done

- **Steps 1–7** of PLAN.md complete and tested.
- **Auto language switching** (`lib/language.ts`): Roman Urdu → `ur-PK-AsadNeural` (male), English → `en-US-AriaNeural`, mixed/unsure → English.
- **Roman Urdu transliteration** (`lib/language.ts`): Roman Urdu text is transliterated to Urdu script before sending to `ur-PK-AsadNeural` voice for natural pronunciation.
- **Kokoro-82M offline fallback** (`lib/kokoro_fallback.py`, `lib/tts.ts`): Edge TTS first, Kokoro locally when Edge fails or is blocked. Model downloaded (~325.5 MB) to `tests/kokoro-models/`.
- **External watcher** (`watcher.py`, `watcher.bat`): Runs outside Claude Code sandbox, watches all `.jsonl` files under `~/.claude/projects/`, detects new replies, generates MP3 via edge-tts, plays via ffplay.
- **Auto-start on Windows**: `watcher.bat` can be added to Startup folder for auto-start on Windows login.
- **Security check PASS** — see `SECURITY-CHECK.md`. No hardcoded keys, no unguarded network egress, `taskkill` scoped to `ffplay.exe`/`ffmpeg.exe`, `.env` gitignored, no git history to leak.
- **GitHub push** — 19 commits on `main`.
- **`marketplace.json`** present in `.claude-plugin/` so the plugin installs from the marketplace.

## Locked decisions

- **Full reply spoken, no 300-char limit.** `lib/summary.ts` has no `MAX_SPOKEN`; only `timeoutMs: 300_000` timeouts remain.
- **API voice optional only.** Default is free Edge TTS with Kokoro fallback. If `ttsProvider` + `apiKey` are both set, the API voice is used — but that path is **not implemented** yet (returns an error, no process call).
- **Option 3: stand-alone plugin** in this folder. Not a fork, no upstream changes, no cache edits.

## GitHub state (19 commits)

```
5d68556 Professional repo: README, plugin.json v0.2.0, LICENSE, STATUS.md, marketplace.json updates
a337d12 Fix watcher.py — full detection with edge-tts + ffplay, stays running
518e289 Change Urdu voice to ur-PK-AsadNeural (male) — more natural for Roman Urdu
aa67ed6 Fix Roman Urdu handling — transliteration to Urdu script for ur-PK-UzmaNeural voice
833fcae Fix: runFor edge-tts/ffplay fallback only
708c50e Fix: playback also needs cmd /c fallback
2f85945 Fix: TTS failed - retry edge-tts via cmd /c in runFor
e44122f Fix: replies not speaking
b377010 Add marketplace.json for plugin install
6d00041 Initial release: claudespeak-windows 0.1.0
... (9 more commits)
```

## Install state

- Installed in Claude Code, enabled in `settings.json`, `/speak` command exists, `/speak on` works.
- Old `albertshiney/claudespeak` uninstalled.
- Installed cache commit: `114d8c0` (verified after reinstall).
- Voice works via `watcher.py` (external watcher), Urdu voice is `ur-PK-AsadNeural` (male), auto-start via `watcher.bat` (add to Startup folder).

## Known issues

- **API voice not implemented** — `lib/tts.ts` returns an error when `ttsProvider` + `apiKey` are both set.
- **`state.playing` cosmetic wart** — `hooks/register.ts:100` leaves `playing = true` if a stop arrives exactly during playback, so `/speak` can report "on" while nothing plays until the next reply.
- **`tsconfig.json` "Cannot read file" in VS Code** is normal — it extends `.claude-plugin/types/tsconfig.json`, which only exists in the Claude Code harness at compile time.
- **PowerShell does not accept `&&`** — use `;` or separate commands.
- **Claude Code push is blocked by its classifier** — push from your own terminal with `git pull --rebase` then `git push`.

## Current state

**Voice works via watcher.py** (external watcher outside sandbox). Urdu voice is `ur-PK-AsadNeural` (male, more natural). Auto-start available via `watcher.bat` in Startup folder. All 6 test suites pass.

## Next step

Run a fresh Claude Code session, ask a Roman Urdu question (e.g., "kya haal hai"), confirm audio is heard with correct Urdu pronunciation via `ur-PK-AsadNeural`. If issues, debug edge-tts in the watcher.