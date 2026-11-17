// Step 4 check: run the TTS voice logic against 2-3 cases with a fake process runner.
// Uses Node's built-in TS type stripping (Node 24+) — no tsc, no vitest, no engine.
import { generate, usesApiVoice, DEFAULT_EDGE_VOICE, MIN_EDGE_TTS } from '../lib/tts.ts'

const fakeRun = argv => ({ exitCode: 0, stdout: '', stderr: '' }) // records the argv it was called with
let lastArgv = null
const recorder = async (argv, _opts) => { lastArgv = argv; return fakeRun(argv) }

const cases = [
  {
    name: 'free Edge path (no provider, no key)',
    cfg: { voice: '', ttsProvider: '', apiKey: '' },
    text: 'Hello from claudespeak-windows.',
    expectOk: true,
    expectProvider: 'edge',
    expectArgvIncludes: ['edge-tts', '-v', DEFAULT_EDGE_VOICE, '--write-media', '-t'],
  },
  {
    name: 'custom Edge voice is passed through',
    cfg: { voice: 'en-US-GuyNeural', ttsProvider: '', apiKey: '' },
    text: 'Hi',
    expectOk: true,
    expectProvider: 'edge',
    expectArgvIncludes: ['edge-tts', '-v', 'en-US-GuyNeural'],
  },
  {
    name: 'API voice opted in -> not implemented yet, no process call',
    cfg: { voice: '', ttsProvider: 'fish', apiKey: 'secret' },
    text: 'Hi',
    expectOk: false,
    expectProvider: null,
    expectArgvIncludes: null,
  },
  {
    name: 'provider set but no key -> falls back to free Edge',
    cfg: { voice: '', ttsProvider: 'fish', apiKey: '' },
    text: 'Hi',
    expectOk: true,
    expectProvider: 'edge',
    expectArgvIncludes: ['edge-tts', '-v', DEFAULT_EDGE_VOICE],
  },
  {
    name: 'empty text -> error, no process call',
    cfg: { voice: '', ttsProvider: '', apiKey: '' },
    text: '   ',
    expectOk: false,
    expectProvider: null,
    expectArgvIncludes: null,
  },
]

let allOk = true
for (const c of cases) {
  lastArgv = null
  const r = await generate(c.cfg, c.text, 'C:\\tmp\\test.mp3', recorder)
  const ok =
    r.ok === c.expectOk &&
    (c.expectProvider === null || r.ok && r.provider === c.expectProvider) &&
    (c.expectArgvIncludes === null
      ? lastArgv === null
      : lastArgv !== null && c.expectArgvIncludes.every(a => lastArgv.includes(a)))
  if (!ok) allOk = false
  console.log(`\n=== ${c.name}`)
  console.log(`  usesApiVoice: ${usesApiVoice(c.cfg)}`)
  console.log(`  result: ${JSON.stringify(r)}`)
  console.log(`  argv: ${lastArgv ? lastArgv.join(' ') : '(none)'}`)
  console.log(`  pass: ${ok}`)
}

console.log(`\nMIN_EDGE_TTS: ${MIN_EDGE_TTS} | DEFAULT_EDGE_VOICE: ${DEFAULT_EDGE_VOICE}`)
console.log(`ALL CASES OK: ${allOk}`)
process.exit(allOk ? 0 : 1)