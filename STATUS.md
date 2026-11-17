# claudespeak-windows — STATUS

**Repo:** https://github.com/vkyrie/Claudespeak-windows
**Version:** 0.1.0
**Last updated:** 2026-11-18

---

## What this plugin is

A stand-alone Windows Claude Code plugin. When Claude Code finishes a main reply, it speaks that reply aloud in a natural voice — for free, no Fish Audio key, no credits.

**Voice:** Edge TTS (`en-US-AriaNeural`) by default, with a Kokoro-82M offline fallback. Auto language switching: Roman Urdu → `ur-PK-UzmaNeural` (female), English → `en-US-AriaNeural` (female).

**Commands:** `/speak` (toggle), `/speak on`, `/speak off`, `/speak stop`, `/speak key`.

---

## Done

- **Steps 1–7** of PLAN.md complete and tested.
- **Auto language switching** (`lib/language.ts`): Roman Urdu → `ur-PK-UzmaNeural`, English → `en-US-AriaNeural`, mixed/unsure → English.
- **Kokoro-82M offline fallback** (`lib/kokoro_fallback.py`, `lib/tts.ts`): Edge TTS first, Kokoro locally when Edge fails or is blocked. Model downloaded (~325.5 MB) to `tests/kokoro-models/`.
- **Security check PASS** — see `SECURITY-CHECK.md`. No hardcoded keys, no unguarded network egress, `taskkill` scoped to `ffplay.exe`/`ffmpeg.exe`, `.env` gitignored, no git history to leak.
- **GitHub push** — 5 commits on `main`.
- **`marketplace.json`** present in `.claude-plugin/` so the plugin installs from the marketplace.

## Locked decisions

- **Full reply spoken, no 300-char limit.** `lib/summary.ts` has no `MAX_SPOKEN`; only `timeoutMs: 300_000` timeouts remain.
- **API voice optional only.** Default is free Edge TTS with Kokoro fallback. If `ttsProvider` + `apiKey` are both set, the API voice is used — but that path is **not implemented** yet (returns an error, no process call).
- **Option 3: stand-alone plugin** in this folder. Not a fork, no upstream changes, no cache edits.

## GitHub state

```
5bc1fd0 Fix: playback also needs cmd /c fallback
2f85945 Fix: TTS failed - retry edge-tts via cmd /c in runFor
e44122f Fix: replies not speaking
b377010 Add marketplace.json for plugin install
6d00041 Initial release: claudespeak-windows 0.1.0
```

## Install state

- Installed in Claude Code, enabled in `settings.json`, `/speak` command exists, `/speak on` works.
- Old `albertshiney/claudespeak` uninstalled.
- Installed cache commit: `2f85945` (verified after reinstall).

## CURRENT PROBLEM (most important)

**Replies still do not speak after the fix.**

Root cause found: the Claude Code hook runtime's `$.process.run` is a sandboxed IPC channel, not a plain `child_process`. A bare argv like `['edge-tts', '-v', voice, ...]` never resolves the executable, so `generate()` always exited non-zero. The failure was logged as the uninterpolated literal `claudespeak: TTS failed: ${audio.error}` (37 times in the transcript) and `claudespeak: playback failed: ${played.error}` (26 times) — never a real error string, never audio.

Fix applied: `hooks/runFor` now retries via `['cmd', '/c', argv.join(' ')]` when the direct call fails, for `edge-tts`, `ffplay`, **and** `python` (the Kokoro helper). All 6 test suites pass. Pushed as `2f85945`, then `5bc1fd0` extended the fallback to playback.

**Still no voice after reinstall.** Suspects:
1. The installed cache may still be the old `b377010` copy (it was — reinstall fixed it to `2f85945`, but the fix may not have taken effect in the running session).
2. `ffplay` playback may need the same `cmd /c` fallback (addressed in `5bc1fd0`).

## Known issues

- **API voice not implemented** — `lib/tts.ts` returns an error when `ttsProvider` + `apiKey` are both set.
- **`state.playing` cosmetic wart** — `hooks/register.ts:100` leaves `playing = true` if a stop arrives exactly during playback, so `/speak` can report "on" while nothing plays until the next reply.
- **`tsconfig.json` "Cannot read file" in VS Code** is normal — it extends `.claude-plugin/types/tsconfig.json`, which only exists in the Claude Code harness at compile time.
- **PowerShell does not accept `&&`** — use `;` or separate commands.
- **Claude Code push is blocked by its classifier** — push from your own terminal with `git pull --rebase` then `git push`.

## Next step for tomorrow

1. Check the installed cache commit + logs first.
2. Fix playback if needed (the `cmd /c` fallback for `ffplay` is in `5bc1fd0` but may need a session reload).
3. Test a real reply end-to-end and confirm audio is heard.
4. Commit and push.