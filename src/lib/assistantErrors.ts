// Turn raw Edge Function / provider failures into something a staff member can
// act on.
//
// `supabase.functions.invoke` surfaces transport-level strings like
// "Edge Function returned a non-2xx status code" and "Failed to send a request
// to the Edge Function", and the AI router surfaces codes like
// NO_AI_PROVIDER_AVAILABLE. None of those tell CA what to do next. Each maps to
// a plain sentence plus whether retrying is worth it.
//
// This only changes what is *shown*. The underlying result is unchanged, and a
// failure is never reported as a success.

export interface FriendlyAssistantError {
  message: string
  /** True when the same request is likely to succeed on a second attempt. */
  retryable: boolean
}

const FALLBACK: FriendlyAssistantError = {
  message: 'Something went wrong on our side. Try again in a moment.',
  retryable: true,
}

// Ordered: the first pattern that matches wins, so specific codes are listed
// before the generic transport strings that would otherwise swallow them.
const RULES: Array<{ match: RegExp; message: string; retryable: boolean }> = [
  {
    match: /NO_AI_PROVIDER_AVAILABLE|no configured (text )?provider|provider route/i,
    message: 'No AI provider is available right now. This usually clears on its own — try again shortly, or ask an admin to check AI Health.',
    retryable: true,
  },
  {
    match: /AI_USAGE_RESERVATION_FAILED|usage limit|quota|rate.?limit|429/i,
    message: 'The AI usage limit for this period has been reached. Ask an admin to check AI Health before trying again.',
    retryable: false,
  },
  {
    match: /timeout|timed out|504|deadline/i,
    message: 'That took too long to answer. Try again, or shorten the question.',
    retryable: true,
  },
  {
    match: /failed to (send|fetch)|networkerror|network request failed|load failed|offline/i,
    message: 'Could not reach CG Assistant. Check your connection and try again.',
    retryable: true,
  },
  {
    match: /jwt|not authenticated|invalid token|401|403|permission/i,
    message: 'Your session has expired. Sign out and back in, then try again.',
    retryable: false,
  },
  {
    match: /non-2xx|500|502|503|internal server error|functionshttperror/i,
    message: 'CG Assistant hit a server error. Try again in a moment — if it keeps happening, tell an admin.',
    retryable: true,
  },
]

export function friendlyAssistantError(raw: string | null | undefined): FriendlyAssistantError {
  const text = (raw ?? '').trim()
  if (!text) return FALLBACK
  for (const rule of RULES) {
    if (rule.match.test(text)) return { message: rule.message, retryable: rule.retryable }
  }
  // An unrecognised message that already reads like a sentence is more useful
  // than a generic apology — but anything that looks like a code, a stack or a
  // raw identifier is replaced rather than shown.
  const looksTechnical =
    /[{}[\]<>]/.test(text) ||            // JSON / markup fragments
    /\b\w+:\/\//.test(text) ||           // any URL scheme, including file://
    /:\d+:\d+/.test(text) ||             // line:column from a stack frame
    /^\s*at\s/i.test(text) ||            // a stack frame itself
    /_[A-Z]{2,}/.test(text) ||           // SCREAMING_SNAKE error codes
    /^[A-Z_]+$/.test(text) ||
    /\b\w+Error\b/.test(text)            // TypeError, FunctionsFetchError, …
  if (!looksTechnical && text.length <= 160 && /[a-z]\s/.test(text)) {
    return { message: /[.!?]$/.test(text) ? text : `${text}.`, retryable: true }
  }
  return FALLBACK
}
