// Language detection check: Roman Urdu -> ur-PK-UzmaNeural, English -> en-US-AriaNeural.
import { detectLanguage, voiceForLanguage, URDU_VOICE, ENGLISH_VOICE } from '../lib/language.ts'

const cases = [
  {
    name: 'Roman Urdu sentence',
    text: 'Main code likh raha hun aur bug fix kar raha hun',
    expectLang: 'urdu',
    expectVoice: URDU_VOICE,
  },
  {
    name: 'Roman Urdu with common words',
    text: 'Yeh kaam bohot aasan hai, bas thora time lagega',
    expectLang: 'urdu',
    expectVoice: URDU_VOICE,
  },
  {
    name: 'English sentence',
    text: 'I am writing code and fixing the bug now.',
    expectLang: 'english',
    expectVoice: ENGLISH_VOICE,
  },
  {
    name: 'English with technical terms',
    text: 'The build failed because of a type error in the auth module.',
    expectLang: 'english',
    expectVoice: ENGLISH_VOICE,
  },
  {
    name: 'Mixed but mostly English -> English',
    text: 'I need to fix this bug quickly, kya aap help kar sakte hain?',
    expectLang: 'english',
    expectVoice: ENGLISH_VOICE,
  },
  {
    name: 'Pure Roman Urdu (no English words)',
    text: 'Aaj ghar ka kaam khatam ho gaya aur abhi rest karna hai',
    expectLang: 'urdu',
    expectVoice: URDU_VOICE,
  },
  {
    name: 'Urdu script (Arabic/Perso-Arabic)',
    text: 'میں کوڈ لکھ رہا ہوں اور بگ فکس کر رہا ہوں',
    expectLang: 'urdu',
    expectVoice: URDU_VOICE,
  },
  {
    name: 'Empty -> defaults to English',
    text: '',
    expectLang: 'english',
    expectVoice: ENGLISH_VOICE,
  },
  {
    name: 'Only punctuation -> defaults to English',
    text: '!!! ??? ...',
    expectLang: 'english',
    expectVoice: ENGLISH_VOICE,
  },
]

let allOk = true
for (const c of cases) {
  const lang = detectLanguage(c.text)
  const voice = voiceForLanguage(lang)
  const ok = lang === c.expectLang && voice === c.expectVoice
  if (!ok) allOk = false
  console.log(`\n=== ${c.name}`)
  console.log(`  text: "${c.text.slice(0, 60)}${c.text.length > 60 ? '...' : ''}"`)
  console.log(`  lang: ${lang} (expected ${c.expectLang}) | voice: ${voice} (expected ${c.expectVoice})`)
  console.log(`  pass: ${ok}`)
}

console.log(`\nURDU_VOICE: ${URDU_VOICE} | ENGLISH_VOICE: ${ENGLISH_VOICE}`)
console.log(`ALL CASES OK: ${allOk}`)
process.exit(allOk ? 0 : 1)