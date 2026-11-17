// Real end-to-end check: play a long clip, then cut it with taskkill and verify
// ffplay is dead. Uses the actual WinGet Gyan ffmpeg and the real taskkill.
import { spawn, execFile } from 'node:child_process'
import { stopSpeech, SPEECH_IMAGES } from '../lib/playback.ts'

const FFMPEG =
  'C:/Users/haniy/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin'
const ffplay = `${FFMPEG}/ffplay.exe`
const clip = 'tests/long.mp3'

const run = (argv, opts) =>
  new Promise(resolve => execFile(argv[0], argv.slice(1), { ...opts }, (err, stdout, stderr) =>
    resolve({ exitCode: err ? (err.code === 1 ? 1 : 0) : 0, stdout: stdout ?? '', stderr: stderr ?? '' }),
  ))

// 1. Play the clip detached so we can cut it from outside.
const child = spawn(ffplay, ['-autoexit', '-nodisp', '-loglevel', 'error', clip], { detached: true })
child.unref()
await new Promise(r => setTimeout(r, 1500)) // let it start

// 2. Cut it immediately with taskkill /IM ffplay.exe /F.
const state = { speechGen: 0, playing: true }
stopSpeech(run, state)
const bumped = state.speechGen === 1

// 3. Confirm ffplay is gone.
await new Promise(r => setTimeout(r, 500))
const list = await new Promise(resolve =>
  execFile('tasklist', ['/FI', 'IM eq ffplay.exe'], (_err, stdout) => resolve(stdout ?? '')),
)
const stillAlive = list.includes('ffplay.exe')
child.kill?.()

console.log(`\n=== real stop: taskkill cut ffplay`)
console.log(`  speechGen bumped: ${bumped}`)
console.log(`  ffplay still running after stop: ${stillAlive}`)
console.log(`  pass: ${bumped && !stillAlive}`)
process.exit(bumped && !stillAlive ? 0 : 1)