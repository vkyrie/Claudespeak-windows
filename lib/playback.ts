// claudespeak-windows: Windows playback and stop logic.
// Pure helpers — no engine, no hooks. The hook passes $.process.run in; tests
// pass a fake, so stopSpeech/playAudio/findFfmpeg are unit-testable.
//
// stopSpeech cuts the current voice by killing ffplay/ffmpeg by image name with
// taskkill — the Windows equivalent of the original's /usr/bin/pkill.

export const PKILL = 'taskkill'
/** Players we cut when speech is stopped or a new reply takes over. */
export const SPEECH_IMAGES = ['ffplay.exe', 'ffmpeg.exe']

export type ProcessRun = (
  argv: string[],
  opts?: { timeoutMs?: number; stdin?: string },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>

export type SpeechState = { speechGen: number; playing: boolean }

/** Where to look for ffplay, in order. */
export const FFPLAY_PATHS = [
  'ffplay',
  'C:\\Windows\\system32\\ffplay.exe',
  'C:\\Windows\\system32\\ffmpeg.exe',
  '/mingw64/bin/ffplay',
  'C:\\Program Files\\ffmpeg\\bin\\ffplay.exe',
  'C:\\Program Files (x86)\\ffmpeg\\bin\\ffplay.exe',
]

/**
 * Cut any currently-playing voice. Bumps speechGen so an in-flight voice notices
 * it was cancelled, and kills the player images by name (taskkill /IM ... /F).
 * The kills are fire-and-forget: a missing player just returns a non-zero exit.
 */
export const stopSpeech = (run: ProcessRun, state: SpeechState): void => {
  state.speechGen += 1
  for (const img of SPEECH_IMAGES) void run([PKILL, '/IM', img, '/F']).catch(() => undefined)
  state.playing = false
}

/** Locate an ffplay binary. */
export const findFfmpeg = async (run: ProcessRun): Promise<string | undefined> => {
  const where = await run(['cmd', '/c', 'where', 'ffplay'])
  if (where.exitCode === 0 && where.stdout.trim() !== '') {
    return where.stdout.trim().split(/\r?\n/)[0].trim()
  }
  for (const p of FFPLAY_PATHS) {
    const r = await run([p, '-version'])
    if (r.exitCode === 0) return p
  }
  return undefined
}

export type PlayResult = { ok: true } | { ok: false; error: string }

/**
 * Play an MP3 through ffplay. Blocks until the clip ends or something cuts it
 * (stopSpeech kills ffplay by image name from another session or prompt.submit).
 */
export const playAudio = async (mp3Path: string, run: ProcessRun): Promise<PlayResult> => {
  const ffplay = await findFfmpeg(run)
  if (ffplay === undefined) return { ok: false, error: 'ffplay not found — install ffmpeg (WinGet Gyan FFmpeg)' }
  // Same sandbox issue as edge-tts: ffplay may not resolve as a bare argv, so
  // the runFor fallback in hooks/register.ts retries it through cmd /c.
  await run([ffplay, '-autoexit', '-nodisp', '-loglevel', 'error', mp3Path], { timeoutMs: 300_000 })
  return { ok: true }
}