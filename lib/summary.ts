// claudespeak-windows: cleans a Claude Code reply for speech.
// Pure helpers — no engine, no voice, no TTS. Windows-only (no Fish Audio,
// no audiotoolbox, no /usr/bin/*).
//
// cleanSpoken() removes markdown, code blocks, URLs, file paths, lists, emoji,
// and delivery tags beyond the first two. The full cleaned reply is spoken —
// no character limit, no Haiku summarisation, no truncation.

/** Summary timeout for the small model, in milliseconds (kept for future use). */
export const SUMMARY_TIMEOUT_MS = 6000

/** The system prompt for a summarising model (kept for future use). */
export const SUMMARY_SYSTEM = [
  'You turn a coding assistant\'s reply into what a voice assistant says out loud.',
  'Write one to three short sentences, under 280 characters in total, in plain conversational English, speaking to the user as "you".',
  'Say what was done or found, and anything the user has to decide or do next.',
  'Never include code, commands, file paths, URLs, markdown, lists, emoji or long numbers.',
  'You may add at most one or two short delivery directions in square brackets before the words they affect, such as [calm], [upbeat] or [laughs].',
  'Output only the words to speak.',
].join('\n')

export type ModelComplete = (opts: {
  model: string
  system: string
  prompt: string
  maxTokens: number
  effort: 'low'
  timeoutMs: number
}) => Promise<{ isAnswered: boolean; text: string }>

/** True when a reply is already plain prose with no markdown, paths, URLs, lists. */
export const isSpeakable = (answer: string): boolean => {
  const text = answer.trim()
  if (text === '') return false
  if (text.split('\n').filter(line => line.trim() !== '').length > 2) return false
  if (/[`*#|<>_{}\\]|^\s*[-+]\s|^\s*\d+\.\s/m.test(text)) return false
  if (/https?:\/\/|www\./i.test(text)) return false
  if (/(^|\s)[~.]?\/?[\w.-]+\/[\w./-]+/.test(text)) return false
  return true
}

/** Makes reply text safe to speak: no markdown, paths, URLs, lists, excessive tags. */
export const cleanSpoken = (raw: string): string => {
  let text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/(^|\s)[~.]?\/?[\w.-]+\/[\w./-]+/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_#>|`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  let tags = 0
  text = text.replace(/\[[^\]]{1,40}\]/g, tag => (++tags <= 2 ? tag : '')).replace(/\s+/g, ' ').trim()
  return text
}

/** Fallback when the summary model gives nothing: the reply's first sentences (kept for future use). */
export const firstSentences = (answer: string): string => {
  const prose = answer
    .replace(/```[\s\S]*?```/g, ' ')
    .split('\n')
    .filter(line => line.trim() !== '' && !/^\s*(?:#|\||[-*+]\s|\d+\.\s)/.test(line))
    .join(' ')
  const sentences = prose.match(/[^.!?]+[.!?]+/g) ?? [prose]
  return cleanSpoken(sentences.slice(0, 2).join(' '))
}

/**
 * Cleans a reply for speech — no truncation, no summarisation, no length limit.
 * If the reply is already plain prose, it is cleaned and returned as-is;
 * otherwise cleanSpoken is applied to the full text.
 * The model callback is no longer called (kept in the signature for future flexibility).
 */
export const summarize = async (
  answer: string,
  _model: string,
  _complete: ModelComplete,
): Promise<string> => {
  if (isSpeakable(answer)) return cleanSpoken(answer)
  return cleanSpoken(answer)
}