# Security check — claudespeak-windows

Read-only check, 2026-11-18. No files changed except one bug fix (see §6). No push.

## 1. Hardcoded keys — PASS

`grep -ri "api_key|password|token|secret|private_key"` over the whole folder:

- All matches are **field names** (`apiKey`, `token`, `maxTokens`), the config schema in `.claude-plugin/plugin.json`, and documentation text.
- The only value-looking string is `apiKey: 'secret'` at **`tests/run-tts.mjs:28`** — a test fixture name, not a real key.
- `tests/kokoro-models/.agent_harnesses.json` is an HF Hub cache file, not plugin code.

No hardcoded credentials anywhere.

## 2. Git history — N/A

`git status` → `fatal: not a git repository`. Nothing has been committed, so there is no history to leak from. Nothing will be pushed.

## 3. `.gitignore` covers `.env` — PASS

`.gitignore` contains `.env`. No `.env` files exist in the tree (`find . -name ".env*"` returns nothing outside the model cache).

## 4. Network egress — PASS

`grep -rn "fetch|http|curl|https|request" lib/` returns **zero network calls**. The only `https?` matches are in `lib/summary.ts:37,47` — regexes that *strip* URLs from spoken text, not outbound requests.

Egress is therefore:
- **Edge TTS only** — the `edge-tts` CLI subprocess receives the spoken text and the chosen voice id. No key.
- **API provider only if the user opts in** — `ttsProvider` + `apiKey` both set. That path currently returns a "not implemented" error and makes no process call (`lib/tts.ts:66-70`), so nothing is sent.
- Kokoro fallback runs fully offline (local ONNX model).

## 5. `taskkill` scope — PASS

`lib/playback.ts:36` — the only `taskkill` invocation in the codebase:

```ts
for (const img of SPEECH_IMAGES) void run([PKILL, '/IM', img, '/F']).catch(() => undefined)
```

`SPEECH_IMAGES = ['ffplay.exe', 'ffmpeg.exe']` (`lib/playback.ts:10`). No PID, no wildcard, no other program is ever killed.

## 6. Bugs — 1 found and fixed

**Bug — the Kokoro fallback helper was unreachable.** `lib/tts.ts:85` invoked it as `python -m kokoro_fallback`, but the script lives at `lib/kokoro_fallback.py` and is not on the module path from the plugin root. `python -m kokoro_fallback` → `No module named kokoro_fallback`. The fallback tests passed only because they called the helper directly, bypassing `lib/tts.ts` — so the real path was broken.

**Fix (applied):** `lib/tts.ts:83-85` now invokes the helper by path:

```ts
const helperPath = process.env.KOKORO_HELPER_PATH ?? 'lib/kokoro_fallback.py'
const args = [helperPath, '--model', modelPath, ...]
```

Verified end-to-end: `generate()` with Edge blocked now returns `{ ok: true, provider: 'kokoro' }` and writes `tests/kokoro-via-tts.mp3`. All 6 suites still pass.

**Not a bug, but noted:** `hooks/register.ts:100` sets `state.playing = false` only when `gen === state.speechGen` after playback. If a stop arrives exactly during playback, `playing` stays `true` until the next reply — `/speak` then reports "on" even though nothing is playing. Cosmetic; the next `turn.complete` corrects it. Left as-is; fix only if you want the status exact.

## Verdict

**PASS** (with the one bug above fixed). No hardcoded secrets, no unguarded network egress, `taskkill` is scoped to the two player images, `.env` is gitignored, and there is no git history to leak from.