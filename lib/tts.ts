// claudespeak-windows: text-to-speech voice logic.
// Pure helpers — no engine, no playback. The hook calls generate() and plays the
// result itself, so this module stays testable without the Claude Code engine.
// The process runner is injected (like summarize's model callback) so the same
// function works under a test fake and under $.process.run in the hook runtime.
//
// Three paths, decided by userConfig:
//   - ttsProvider + apiKey both set  -> use the paid API voice (Step 4b, not this step)
//   - otherwise                      -> free Edge TTS, default en-US-AriaNeural
//   - Edge fails / blocked           -> Kokoro-82M offline fallback (Step 6)
// Kokoro runs locally through a Python helper (kokoro-onnx), no internet needed.

export type TtsConfig = {
  voice: string
  ttsProvider: string
  apiKey: string
}

/** True when the user has opted into a paid API voice. */
export const usesApiVoice = (cfg: TtsConfig): boolean =>
  cfg.ttsProvider !== '' && cfg.apiKey !== ''

/** The Edge TTS voice id used when no API voice is configured. */
export const DEFAULT_EDGE_VOICE = 'en-US-AriaNeural'

/** The edge-tts minimum version this plugin requires (Microsoft changed auth in Oct 2026). */
export const MIN_EDGE_TTS = '7.3.1'

export type ProcessRun = (
  argv: string[],
  opts?: { timeoutMs?: number; stdin?: string },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>

export type GenerateResult =
  | { ok: true; path: string; provider: 'edge' | 'api' | 'kokoro' }
  | { ok: false; error: string }

/** Kokoro-82M voice ids, keyed by detected language. */
export const KOKORO_VOICE = {
  en: 'af_sarah',
  ur: 'af_sarah',
} as const

/** Map an Edge TTS voice id to the closest Kokoro voice id. */
export const kokoroVoiceFor = (edgeVoice: string): string =>
  edgeVoice.startsWith('ur-') ? KOKORO_VOICE.ur : KOKORO_VOICE.en

/**
 * Generate speech audio for `text` to an MP3 at `outPath`.
 * - API voice path: not implemented yet (Step 4b). Returns an error, never throws.
 * - Edge path: runs the edge-tts CLI (>= MIN_EDGE_TTS) with the configured voice.
 * - Kokoro path: runs the Python helper (kokoro-onnx) locally when Edge fails or
 *   is blocked. No internet needed; the model must be downloaded once.
 * If `voiceOverride` is provided, it takes precedence over the config voice.
 */
export const generate = async (
  cfg: TtsConfig,
  text: string,
  outPath: string,
  run: ProcessRun,
  voiceOverride?: string,
): Promise<GenerateResult> => {
  if (text.trim() === '') return { ok: false, error: 'empty text' }

  if (usesApiVoice(cfg)) {
    return {
      ok: false,
      error: `API voice (${cfg.ttsProvider}) is not implemented yet — use the free Edge voice, or wait for Step 4b.`,
    }
  }

  const voice = voiceOverride?.trim()
    ?? (cfg.voice.trim() !== '' ? cfg.voice.trim() : DEFAULT_EDGE_VOICE)
  const edgeTts = process.env.EDGE_TTS_PATH ?? 'edge-tts'

  // 1. Try Edge TTS first.
  const result = await run([edgeTts, '-v', voice, '--write-media', outPath, '-t', text], { timeoutMs: 120_000 })
  if (result.exitCode === 0) return { ok: true, path: outPath, provider: 'edge' }

  // 2. Edge failed or is blocked -> fall back to Kokoro-82M offline.
  const kokoroVoice = kokoroVoiceFor(voice)
  const kokoro = process.env.KOKORO_PYTHON ?? 'python'
  // The helper ships at lib/kokoro_fallback.py, so invoke it by path rather than
  // -m (which would need it on the module path from the plugin root).
  const helperPath = process.env.KOKORO_HELPER_PATH ?? 'lib/kokoro_fallback.py'
  const modelPath = process.env.KOKORO_MODEL_PATH ?? ''
  const voicePath = process.env.KOKORO_VOICE_PATH ?? ''
  const args = [helperPath, '--model', modelPath, '--voice', voicePath, '--out', outPath, '--text', text, '--voice-id', kokoroVoice]
  const fallback = await run([kokoro, ...args], { timeoutMs: 300_000 })
  if (fallback.exitCode !== 0) {
    const detail = (fallback.stderr || '').trim().slice(0, 200)
    return {
      ok: false,
      error: `Edge TTS failed and Kokoro fallback failed: ${detail || fallback.stderr || 'no output'}`,
    }
  }
  return { ok: true, path: outPath, provider: 'kokoro' }
}