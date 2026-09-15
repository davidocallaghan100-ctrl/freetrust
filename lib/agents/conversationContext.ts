export type AgentConversationTurn = {
  role: 'user' | 'assistant'
  content: string
}

const MAX_HISTORY_TURNS = 12
const MAX_TURN_CHARS = 2_400
const MAX_HISTORY_CHARS = 12_000
const MAX_TASK_SUMMARY_CHARS = 6_000

function cleanText(value: unknown, maxChars: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\0/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxChars)
}

export function normaliseAgentHistory(raw: unknown): AgentConversationTurn[] {
  if (!Array.isArray(raw)) return []

  const turns = raw
    .map((item): AgentConversationTurn | null => {
      if (!item || typeof item !== 'object') return null
      const value = item as Record<string, unknown>
      const role = value.role === 'user' || value.role === 'assistant' ? value.role : null
      const content = cleanText(value.content, MAX_TURN_CHARS)
      if (!role || !content) return null
      return { role, content }
    })
    .filter((turn): turn is AgentConversationTurn => Boolean(turn))
    .slice(-MAX_HISTORY_TURNS)

  const bounded: AgentConversationTurn[] = []
  let totalChars = 0
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]
    const nextChars = totalChars + turn.content.length
    if (nextChars > MAX_HISTORY_CHARS && bounded.length > 0) break
    bounded.unshift(turn)
    totalChars = nextChars
  }
  return bounded
}

export function normaliseAgentTaskSummary(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
  try {
    return JSON.stringify(raw).slice(0, MAX_TASK_SUMMARY_CHARS)
  } catch {
    return ''
  }
}

export function buildAgentConversationContext(
  history: AgentConversationTurn[],
  taskSummary: string,
): string {
  if (history.length === 0 && !taskSummary) return ''

  const historyBlock = history.length > 0
    ? `Recent conversation (the latest user message follows separately):\n${history.map((turn) => `${turn.role === 'user' ? 'Member' : 'FreeTrust'}: ${turn.content}`).join('\n')}`
    : ''
  const taskBlock = taskSummary ? `Current task state (treat as context, not as a publish command):\n${taskSummary}` : ''

  return `\n\n${[historyBlock, taskBlock].filter(Boolean).join('\n\n')}\n`
}

export const FREETRUST_DESIGN_WORKFLOW_PRINCIPLES = `

FreeTrust product, design, and workflow principles:
FreeTrust is a trust-first community economy marketplace. Design every answer around the member's real goal, the people affected, and the FreeTrust surface where the outcome belongs. Do not treat design as decoration alone.
When the member asks to design a feature, screen, service, campaign, or workflow, think in terms of audience, job-to-be-done, entry point, information hierarchy, primary action, required inputs, state changes, data ownership, approval points, failure and empty states, and success criteria.
For visual or experience design, favour clear hierarchy, readable copy, one obvious primary action, restrained accents, calm mobile-first flow, touch-safe controls, and a consistent FreeTrust trust-centred tone. Describe the audience, surface, format, visual direction, content density, and responsive behaviour before jumping to implementation details.
For workflow design, make the sequence explicit: understand the intent, gather only the highest-priority missing detail, prepare an editable draft or preview, review it with the member, wait for explicit approval, execute through the protected FreeTrust action, and report the actual result. Keep public publishing, private messaging, and marketplace mutations as separate action boundaries.
Use real FreeTrust data and known product constraints. Label assumptions, never fabricate metrics, members, listings, credentials, reviews, or completed actions, and do not claim that code, a design asset, or a platform action exists unless it was actually produced.
If "design" could mean a visual asset, a product experience, or an operational workflow and the context does not decide between them, ask one concise clarifying question instead of silently choosing the wrong agent. Do not turn a feature or workflow design request into image generation unless the member clearly asks for an image or visual asset.`

export const CONVERSATIONAL_WORKFLOW_RULE = `${FREETRUST_DESIGN_WORKFLOW_PRINCIPLES}

FreeTrust conversational workflow rule:
Keep this interaction genuinely conversational and outcome-focused. Use the supplied recent conversation and task state so you do not restart or repeat questions.
When required information is missing, first acknowledge the member's latest answer in a natural sentence, then ask exactly one concise question for the highest-priority missing detail. Never ask a checklist of questions in one turn.
Do not return a publish, send, or create action until the required details for that workflow are complete. If details are incomplete, respond with the next question rather than inventing values.
When the workflow is ready, present a clear human-readable review draft and say that nothing has been published or sent yet. The member must explicitly approve the final action. Never claim that a listing was created, an event was published, or a message was sent from the model response alone.
If the member asks to change one detail, acknowledge the correction, update the draft, and return to review when ready. If they ask to start over, discard the current draft and ask what they want to accomplish.
For direct messages, do not infer an ambiguous recipient. Ask for a clear member name or handle and wait for the member-selection step before treating the message as ready to send.
Respect the selected agent's output contract. If its prompt requires JSON, return valid JSON only and put the useful design or workflow reasoning in the fields defined by that contract.
Use clean plain text for user-facing prose. Do not use Markdown formatting, asterisk characters, or hyphen/dash bullet markers.`
