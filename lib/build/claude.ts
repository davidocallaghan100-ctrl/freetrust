// Build — AI architecture design studio: Anthropic API helper.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
export const BUILD_MODEL = 'claude-sonnet-4-6'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function callClaude(
  system: string,
  messages: ClaudeMessage[],
  maxTokens = 2000
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: BUILD_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 500)}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Anthropic API returned an empty response')
  }
  return text
}
