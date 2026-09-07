const INTERNAL_OUTPUT_PATTERNS = [
  /here(?:'|’)s (?:a|the) thinking process/i,
  /\bchain[- ]of[- ]thought\b/i,
  /\binternal (?:analysis|instruction|policy|reasoning)\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper message\b/i,
  /\btool registry\b/i,
  /\broute diagnostics?\b/i,
  /\bbackend implementation\b/i,
  /\bstep[- ]by[- ]step analysis\b/i,
  /\bstatus is intentionally omitted\b/i,
]

const DETAIL_REQUEST = /\b(detail(?:ed)?|explain|breakdown|full|thorough|step[- ]by[- ]step|list all|everything)\b/i

export const UNSAFE_ASSISTANT_REPLY = 'I could not give you a safe answer there. Please try that again.'

function stripMarkdownLine(line: string): string {
  const withoutPrefix = line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s{0,3}>\s?/, '')
    .replace(/^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/, '')
  return withoutPrefix
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]+/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function plainSentences(value: string): string[] {
  const lines = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map(stripMarkdownLine)
    .filter(Boolean)
    .map(line => /[.!?]$/.test(line) ? line : `${line}.`)

  const plain = lines.join(' ').replace(/\s+/g, ' ').trim()
  return plain.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? []
}

function clampAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const clipped = value.slice(0, maxLength + 1)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${clipped.slice(0, lastSpace > maxLength * 0.7 ? lastSpace : maxLength).trim()}…`
}

/**
 * Final display boundary for ordinary CG Assistant replies.
 *
 * Provider output is untrusted presentation input. This removes Markdown syntax,
 * blocks reasoning/prompt leakage, and keeps an ordinary turn to four short
 * sentences unless the user explicitly asked for a detailed answer.
 */
export function presentAssistantReply(value: string, userMessage = ''): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || INTERNAL_OUTPUT_PATTERNS.some(pattern => pattern.test(raw))) return UNSAFE_ASSISTANT_REPLY

  const sentences = plainSentences(raw)
  if (sentences.length === 0) return UNSAFE_ASSISTANT_REPLY

  const detailed = DETAIL_REQUEST.test(userMessage)
  const sentenceLimit = detailed ? 12 : 4
  const characterLimit = detailed ? 2200 : 640
  const answer = sentences.slice(0, sentenceLimit).join(' ')
  return clampAtWord(answer, characterLimit)
}

export function joinSpeechTranscript(...parts: Array<string | null | undefined>): string {
  return parts
    .map(part => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
