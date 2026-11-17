// Step 3 check: run the summary helpers against 2-3 sample replies.
// Uses Node's built-in TS type stripping (Node 24+) — no tsc, no vitest, no engine.
import { summarize, isSpeakable, cleanSpoken, firstSentences } from '../lib/summary.ts'

const MODEL = 'haiku'

// A fake model: no longer called, but kept in signature.
const fakeComplete = async ({ prompt }) => ({
  isAnswered: true,
  text: '[calm] I added the retry wrapper around the network call and the tests pass now. Next, raise the timeout in the config.',
})

const cases = [
  {
    name: 'short plain reply (already speakable, no model call)',
    reply: 'Done. The login bug is fixed and the tests pass now.',
  },
  {
    name: 'long reply with code and paths (needs cleaning)',
    reply:
      'Here is the implementation you asked for. First I refactored src/auth/login.ts to use the new retry wrapper, because the old one threw on timeouts. ' +
      '```ts\nexport async function login(email: string) {\n  return await fetch("/api/login", { method: "POST" })\n}\n``` ' +
      'Then I updated the tests in tests/auth.test.ts. See https://example.com/docs for more. Run `npm test` to verify.',
  },
  {
    name: 'multi-line list reply (needs cleaning)',
    reply:
      'I made the following changes:\n- Added retry logic to the network layer\n- Updated the config defaults\n- Fixed the failing test in auth.test.ts\n- Bumped the version to 1.4.2',
  },
]

let allOk = true
for (const c of cases) {
  const summary = await summarize(c.reply, MODEL, fakeComplete)
  const ok = summary.trim() !== ''
  if (!ok) allOk = false
  console.log(`\n=== ${c.name}`)
  console.log(`  speakable (pre-check): ${isSpeakable(c.reply)}`)
  console.log(`  summary (${summary.length} chars, no limit): "${summary}"`)
  console.log(`  non-empty: ${ok}`)
}

console.log(`\nALL CASES OK: ${allOk}`)
process.exit(allOk ? 0 : 1)