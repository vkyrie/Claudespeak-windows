// Step 5 check: run the playback/stop logic against 3 scenarios with a fake runner.
// Uses Node's built-in TS type stripping (Node 24+) — no tsc, no vitest, no engine.
import { stopSpeech, findFfmpeg, playAudio, SPEECH_IMAGES, PKILL, FFPLAY_PATHS } from '../lib/playback.ts'

const run = argv => ({ exitCode: 0, stdout: '', stderr: '' })
let calls = []
const recorder = async (argv, _opts) => { calls.push(argv); return run(argv) }

// 1. stopSpeech kills ffplay/ffmpeg by image name and bumps speechGen.
const s1 = { speechGen: 0, playing: true }
stopSpeech(recorder, s1)
const killArgs = calls.filter(c => c[0] === PKILL).map(c => c[2])
const ok1 = s1.speechGen === 1 && s1.playing === false &&
  SPEECH_IMAGES.every(img => killArgs.includes(img))

// 2. findFfmpeg tries `where` first, then falls back to the path list.
// The fake runner returns exit 0 for everything, so `where` succeeds with empty
// stdout and it falls back to the first path in FFPLAY_PATHS.
calls = []
const found = await findFfmpeg(recorder)
const ok2 = found === FFPLAY_PATHS[0] && calls[0][0] === 'cmd'

// 3. playAudio plays through ffplay and stopSpeech can cut it mid-play.
calls = []
const s3 = { speechGen: 0, playing: false }
// Pretend ffplay is running: the fake `where` still resolves, so playAudio runs it.
const p = await playAudio('tests/test-summary.mp3', recorder)
// Now stop it: stopSpeech must kill ffplay/ffmpeg.
stopSpeech(recorder, s3)
const killedDuring = calls.filter(c => c[0] === PKILL).map(c => c[2])
const ok3 = p.ok && s3.speechGen === 1 && SPEECH_IMAGES.every(img => killedDuring.includes(img))

console.log(`\n=== 1. stopSpeech cuts the current voice`)
console.log(`  speechGen bumped: ${s1.speechGen === 1} | playing: ${s1.playing}`)
console.log(`  taskkill args: ${JSON.stringify(killArgs)} | pass: ${ok1}`)
console.log(`\n=== 2. findFfmpeg locates ffplay`)
console.log(`  found: ${found} | pass: ${ok2}`)
console.log(`\n=== 3. playAudio plays, stopSpeech cuts it`)
console.log(`  played: ${p.ok} | stop killed: ${JSON.stringify(killedDuring)} | pass: ${ok3}`)
console.log(`\nPKILL: ${PKILL} | SPEECH_IMAGES: ${JSON.stringify(SPEECH_IMAGES)}`)
console.log(`ALL CASES OK: ${ok1 && ok2 && ok3}`)
process.exit(ok1 && ok2 && ok3 ? 0 : 1)