// claudespeak-windows: language detection for auto voice switching.
// Pure helpers — no engine, no TTS. Determines which Edge TTS voice to use.
//
// Urdu script (Arabic/Perso-Arabic) is unambiguous. Roman Urdu is detected from
// words that are distinctively Urdu — never English. English tech words (code,
// bug, fix, build, error, module, ...) are deliberately excluded so an English
// reply is never mistaken for Urdu. Mixed content defaults to English.

export const URDU_VOICE = 'ur-PK-UzmaNeural'
export const ENGLISH_VOICE = 'en-US-AriaNeural'

/** Words that are distinctively Urdu (not English) — strong indicators. */
const ROMAN_URDU_WORDS = new Set([
  // Pronouns
  'main', 'tum', 'aap', 'hum', 'yeh', 'woh', 'ye', 'wo', 'iska', 'uska', 'mera', 'tera',
  'meri', 'teri', 'hamara', 'tumhara', 'unka', 'inko', 'unko', 'isko', 'usko',
  'mujhe', 'tujhe', 'inhe', 'unhe', 'mujh', 'tujh',
  // Verbs
  'hai', 'hain', 'tha', 'thi', 'the', 'hoga', 'hoge', 'hogy', 'hun', 'hu',
  'kar', 'karna', 'kiya', 'kiye', 'karta', 'karte', 'karti', 'karo', 'karoon',
  'ho', 'hona', 'hon', 'kuch', 'kya', 'kyun', 'kaise', 'kahan', 'kab', 'kaun',
  'kitna', 'kitni', 'likh', 'likhna', 'parh', 'parhna', 'chhod', 'chhodna',
  'de', 'den', 'le', 'lena', 'jao', 'jaao', 'chalo', 'aao', 'hojao', 'hojaye',
  // Adverbs / connectors
  'aur', 'lekin', 'magar', 'par', 'to', 'toh', 'agar', 'phir', 'abhi', 'ab',
  'tab', 'jab', 'jaise', 'waise', 'aise', 'zyada', 'kam', 'bohot', 'bahut',
  'thora', 'thodi', 'bas', 'hi', 'bhi', 'nahi', 'nahin', 'na', 'ji', 'han',
  'haan', 'theek', 'sahi', 'galat', 'sab', 'koi', 'sirf', 'hamesha', 'aaj',
  'kal', 'parso', 'roz', 'pehle', 'baad', 'sath', 'bina', 'baghair',
  // Nouns / daily
  'baat', 'kaam', 'waqt', 'din', 'raat', 'subah', 'sham', 'ghar', 'bahar',
  'andar', 'upar', 'neeche', 'paas', 'door', 'pani', 'khana', 'chai', 'dost',
  'maa', 'baap', 'bhai', 'behen', 'beta', 'beti', 'paisa', 'rupee', 'gali',
  'bazar', 'shehar', 'qila', 'kitab', 'kalam', 'daftar', 'kaghaz', 'zindagi',
  'duniya', 'jahan', 'dua', 'salaam', 'shukriya', 'meharbani', 'roti', 'chawal',
  'dal',
])

const URDU_SCRIPT_REGEX = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

/** Fraction of words that must be distinctively Urdu to classify as Urdu. */
const URDU_THRESHOLD = 0.4

export type DetectedLang = 'urdu' | 'english'

/**
 * Detect the language of a reply.
 * - Urdu script -> urdu
 * - >= URDU_THRESHOLD of words are distinctively Urdu -> urdu
 * - Otherwise -> english (default, including mixed content)
 */
export const detectLanguage = (text: string): DetectedLang => {
  const trimmed = text.trim()
  if (!trimmed) return 'english'

  // Urdu script (Arabic/Perso-Arabic) -> definitely Urdu
  if (URDU_SCRIPT_REGEX.test(trimmed)) return 'urdu'

  // Count distinctively Urdu words
  const words = trimmed.toLowerCase().split(/\s+/)
  let urduCount = 0
  let totalWords = 0
  for (const w of words) {
    if (w.length < 2) continue
    totalWords++
    if (ROMAN_URDU_WORDS.has(w)) urduCount++
  }

  if (totalWords > 0 && urduCount / totalWords >= URDU_THRESHOLD) return 'urdu'
  return 'english'
}

/** Get the Edge TTS voice for the detected language. */
export const voiceForLanguage = (lang: DetectedLang): string =>
  lang === 'urdu' ? URDU_VOICE : ENGLISH_VOICE