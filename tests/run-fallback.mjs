// Step 6 check: Kokoro-82M offline fallback. When Edge TTS fails (blocked/offline),
// generate() falls back to the local Kokoro helper and still produces audio.
// Uses Node's built-in TS type stripping (Node 24+) — no tsc, no vitest, no engine.
import { generate, usesApiVoice, KOKORO_VOICE, kokoroVoiceFor } from '../lib/tts.ts'
import { execFileSync } from 'node:child_process'

const MODEL = 'tests/kokoro-models/onnx/model.onnx'
const VOICE = 'tests/kokoro-models/voices-v1.0.bin'
const OUT = 'tests/kokoro-fallback.mp3'

// A runner that fails the edge-tts call (simulating blocked/offline Edge) and
// succeeds the python kokoro_fallback call.
const failingEdgeRun = async argv => {
  if (argv[0] === 'edge-tts') {
    return { exitCode: 1, stdout: '', stderr: 'Could not connect to Edge TTS (offline)' }
  }
  return { exitCode: 0, stdout: '', stderr: '' }
}

const cases = [
  {
    name: 'Edge blocked -> Kokoro fallback produces audio',
    cfg: { voice: '', ttsProvider: '', apiKey: '' },
    text: 'This is a test of the Kokoro-82M offline fallback.',
    run: failingEdgeRun,
    expectOk: true,
    expectProvider: 'kokoro',
  },
  {
    name: 'Edge succeeds -> no fallback',
    cfg: { voice: '', ttsProvider: '', apiKey: '' },
    text: 'Hello',
    run: async argv => argv[0] === 'edge-tts'
      ? { exitCode: 0, stdout: '', stderr: '' }
      : { exitCode: 1, stdout: '', stderr: 'should not run' },
    expectOk: true,
    expectProvider: 'edge',
  },
  {
    name: 'Kokoro fallback also fails -> error',
    cfg: { voice: '', ttsProvider: '', apiKey: '' },
    text: 'Hello',
    run: async argv => ({ exitCode: 1, stdout: '', stderr: 'kokoro broken' }),
    expectOk: false,
    expectProvider: null,
  },
]

let allOk = true
for (const c of cases) {
  const r = await generate(c.cfg, c.text, OUT, c.run, 'en-US-AriaNeural')
  const ok = r.ok === c.expectOk && (c.expectProvider === null || r.ok && r.provider === c.expectProvider)
  if (!ok) allOk = false
  console.log(`\n=== ${c.name}`)
  console.log(`  usesApiVoice: ${usesApiVoice(c.cfg)}`)
  console.log(`  result: ${JSON.stringify(r)}`)
  console.log(`  pass: ${ok}`)
}

// Voice mapping for the detected language.
console.log(`\nKOKORO_VOICE.en: ${KOKORO_VOICE.en} | kokoroVoiceFor(en-US-AriaNeural): ${kokoroVoiceFor('en-US-AriaNeural')}`)
console.log(`kokoroVoiceFor(ur-PK-UzmaNeural): ${kokoroVoiceFor('ur-PK-UzmaNeural')}`)

// Run the real Kokoro helper to prove the fallback actually speaks.
let realOk = false
try {
  execFileSync('python', [
    'lib/kokoro_fallback.py',
    '--model', MODEL, '--voice', VOICE,
    '--out', OUT,
    '--text', 'This is a test of the Kokoro-82M offline fallback.',
    '--voice-id', 'af_sarah', '--lang', 'en-us',
  ], { stdio: 'pipe' })
  realOk = true
} catch (e) {
  console.log(`\nreal Kokoro helper failed: ${e.message}`)
}
console.log(`\n=== real Kokoro helper`)
console.log(`  produced ${OUT}: ${realOk}`)
console.log(`ALL CASES OK: ${allOk && realOk}`)
process.exit(allOk && realOk ? 0 : 1)