import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { generate, type TtsConfig } from '../lib/tts'
import { summarize } from '../lib/summary'
import { playAudio, stopSpeech, type ProcessRun, type SpeechState } from '../lib/playback'
import { detectLanguage, voiceForLanguage } from '../lib/language'

// claudespeak-windows: speaks the full finished main reply aloud on Windows.
// Edge TTS default (en-US-AriaNeural), Kokoro-82M offline fallback (Step 6).
// Auto voice switching: Roman Urdu -> ur-PK-UzmaNeural, English -> en-US-AriaNeural.
// No Fish Audio. One voice at a time; quiet in sub-agents, -p, scheduled runs.
//
// Step 5+ (auto voice): detect reply language, pick the right Edge TTS voice.

type $ = EngineInterface

const DEFAULT_SUMMARY_MODEL = 'haiku'
const DEFAULT_VOICE = 'en-US-AriaNeural'

const readString = (options: PluginOptions, key: string): string => {
  const value = options[key]
  return typeof value === 'string' ? value.trim() : ''
}

const runFor = ($: $): ProcessRun => async (argv, opts) => {
  // The hook runtime's $.process.run is a sandboxed IPC channel, not a plain
  // child_process: a bare executable like edge-tts or ffplay may not resolve.
  // Try the argv directly first, then fall back to the Windows shell (cmd /c)
  // with the whole command as one string — the form that actually runs them.
  // Python helper must NOT be retried via shell: its args are positional and
  // joining them into a single string breaks argument parsing.
  let ran = await $.process.run(argv, { timeoutMs: opts?.timeoutMs, stdin: opts?.stdin })
  if (ran.exitCode !== 0 && (argv[0] === 'edge-tts' || argv[0] === 'ffplay')) {
    const shell = await $.process.run(['cmd', '/c', argv.join(' ')], { timeoutMs: opts?.timeoutMs })
    if (shell.exitCode === 0) ran = shell
  }
  console.log(`claudespeak: process.run ${JSON.stringify(argv)} -> ${JSON.stringify(ran)}`)
  return { exitCode: ran.exitCode, stdout: ran.stdout, stderr: ran.stderr }
}

export const register: Register = (on, options: PluginOptions) => {
  const summaryModel = readString(options, 'summaryModel') || DEFAULT_SUMMARY_MODEL
  const tts: TtsConfig = {
    voice: readString(options, 'voice') || DEFAULT_VOICE,
    ttsProvider: readString(options, 'ttsProvider'),
    apiKey: readString(options, 'apiKey'),
  }
  const state: SpeechState = { speechGen: 0, playing: false }

  // A new prompt means the person has moved on: cut the old reply's speech.
  on('prompt.submit', ($, _e, next) => {
    stopSpeech(runFor($), state)
    return next()
  })

  on('command.run', { command: 'speak' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop') {
      stopSpeech(runFor($), state)
      return { text: 'Stopped speaking.' }
    }
    if (arg === 'off') {
      stopSpeech(runFor($), state)
      return { text: 'Spoken replies are off.' }
    }
    if (arg === 'on') {
      state.playing = false
      return { text: 'Spoken replies are on.' }
    }
    return { text: `Spoken replies are ${state.playing ? 'on' : 'off'}.` }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Only the main agent's answer, never a sub-agent, tool continuation, or empty reply.
    const isMainAnswer = e.agentId === undefined && e.reason === 'answer' && e.answer.trim() !== ''
    if (!isMainAnswer) return result

    // One voice at a time: a new reply stops the old voice first.
    stopSpeech(runFor($), state)
    const gen = state.speechGen

    const text = await summarize(e.answer, summaryModel, async opts => $.model.complete(opts))
    if (text.trim() === '' || gen !== state.speechGen) return result

    // Auto-detect language and pick the voice for this reply.
    const lang = detectLanguage(e.answer)
    const voice = voiceForLanguage(lang)

    const outPath = `${await tmpDir($)}claudespeak-${await $.clock.now()}.mp3`
    const audio = await generate(tts, text, outPath, runFor($), voice)
    if (!audio.ok) {
      console.log(`claudespeak: TTS failed: ${audio.error}`)
      await rm($, outPath)
      return result
    }
    if (gen !== state.speechGen) {
      // A stop or a newer reply arrived while we were generating. Don't play.
      await rm($, outPath)
      return result
    }
    state.playing = true
    console.log(
      `claudespeak: turn.complete (${e.answer.length} chars, lang=${lang}, voice=${voice}) -> ${audio.provider} audio (${text.length} chars text) -> ${outPath}`,
    )
    // Play until the clip ends or something cuts it. A newer reply or /speak stop
    // bumps speechGen and kills ffplay by image name, which ends this call.
    const played = await playAudio(audio.path, runFor($)).catch(err => ({ ok: false, error: String(err) }))
    if (!played.ok) console.log(`claudespeak: playback failed: ${played.error}`)
    await rm($, outPath)
    if (gen === state.speechGen) state.playing = false
    return result
  })

  on('session.end', ($, _e, next) => {
    stopSpeech(runFor($), state)
    return next()
  })
}

async function tmpDir($: $): Promise<string> {
  const dir = (await $.env.get('TMPDIR')) ?? (await $.env.get('TEMP')) ?? (await $.env.get('TMP')) ?? 'C:\\Windows\\Temp'
  return dir.replace(/[\\/]+$/, '') + '\\'
}

async function rm($: $, ...paths: string[]): Promise<void> {
  for (const p of paths) await $.process.run(['cmd', '/c', 'del', '/f', '/q', p]).catch(() => undefined)
}