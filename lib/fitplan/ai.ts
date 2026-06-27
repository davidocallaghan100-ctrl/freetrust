import Anthropic from '@anthropic-ai/sdk'
import { FITPLAN_MODEL } from '@/lib/fitplan/constants'
import { fitPlanSafetyNote, type FitPlanProfile } from '@/lib/fitplan/server'

function anthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('FitPlan AI is not configured')
  return new Anthropic({ apiKey })
}

function extractText(message: Anthropic.Messages.Message) {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim()
}

export function parseJsonObject<T>(text: string): T {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI did not return JSON')
    return JSON.parse(match[0]) as T
  }
}

async function repairAndParseJsonObject<T>(input: {
  client: Anthropic
  badJson: string
  parseError: unknown
  shape: string
}) {
  const repair = await input.client.messages.create({
    model: FITPLAN_MODEL,
    max_tokens: 3200,
    temperature: 0,
    system: `You repair invalid JSON. Return one valid JSON object only, with no markdown fences, comments, prose, or trailing commas. Preserve the user's meaning, but fix commas, brackets, quotes, and escaping. Required shape: ${input.shape}`,
    messages: [{
      role: 'user',
      content: `This JSON failed to parse with: ${input.parseError instanceof Error ? input.parseError.message : String(input.parseError)}\n\nRepair it and return valid JSON only:\n${input.badJson.slice(0, 18000)}`,
    }],
  })
  return parseJsonObject<T>(extractText(repair))
}

export type FitPlanAiPlan = {
  summary: string
  safety: string[]
  dailyTargets: { steps?: string; hydration?: string; protein?: string; sleep?: string }
  workouts: Array<{ day: string; focus: string; durationMinutes: number; blocks: string[]; modifications?: string[] }>
  nutrition: { approach: string; meals: string[]; prepTips: string[]; avoid?: string[] }
  habits: string[]
  checkinQuestions: string[]
}

export async function generateFitPlan(profile: FitPlanProfile): Promise<FitPlanAiPlan> {
  const client = anthropicClient()
  const planShape = `{"summary":"string","safety":["string"],"dailyTargets":{"steps":"string","hydration":"string","protein":"string","sleep":"string"},"workouts":[{"day":"string","focus":"string","durationMinutes":35,"blocks":["string"],"modifications":["string"]}],"nutrition":{"approach":"string","meals":["string"],"prepTips":["string"],"avoid":["string"]},"habits":["string"],"checkinQuestions":["string"]}`
  const message = await client.messages.create({
    model: FITPLAN_MODEL,
    max_tokens: 2400,
    temperature: 0.25,
    system: `You are FreeTrust FitPlan, a careful fitness and nutrition coach. Return one valid JSON object only. No markdown fences, comments, prose, or trailing commas. Every array item must be comma-separated. Never invent medical certainty. Never recommend extreme dieting, unsafe supplements, or diagnosing/treating conditions. ${fitPlanSafetyNote(profile)} JSON shape: ${planShape}`,
    messages: [{
      role: 'user',
      content: `Create a practical 7-day FitPlan from this profile. Keep it mobile-readable, specific, conservative, and achievable. Use kg internally. Profile JSON:\n${JSON.stringify(profile)}`,
    }],
  })
  const text = extractText(message)
  try {
    return parseJsonObject<FitPlanAiPlan>(text)
  } catch (err) {
    console.warn('[FitPlan AI] initial plan JSON parse failed; attempting repair:', err)
    return repairAndParseJsonObject<FitPlanAiPlan>({ client, badJson: text, parseError: err, shape: planShape })
  }
}

export async function answerFitPlanCoach(input: { profile: FitPlanProfile; plan: unknown; question: string; recentMessages: Array<{ role: string; content: string }> }) {
  const client = anthropicClient()
  const history = input.recentMessages.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n')
  const message = await client.messages.create({
    model: FITPLAN_MODEL,
    max_tokens: 900,
    temperature: 0.35,
    system: `You are FreeTrust FitPlan coach. Give concise, safe, action-first coaching. ${fitPlanSafetyNote(input.profile)} If doctor_clearance is no, include a GP/qualified-professional clearance reminder and avoid intensity prescriptions. No markdown tables.`,
    messages: [{ role: 'user', content: `Profile: ${JSON.stringify(input.profile)}\nActive plan: ${JSON.stringify(input.plan).slice(0, 8000)}\nRecent chat:\n${history}\n\nUser question: ${input.question}` }],
  })
  return extractText(message)
}

export async function generateCheckinFeedback(input: { profile: FitPlanProfile; plan: unknown; wins: string; blockers: string; adherence: number | null }) {
  const client = anthropicClient()
  const checkinShape = `{"headline":"string","feedback":"string","nextActions":["string"],"adjustments":["string"],"safety":["string"]}`
  const message = await client.messages.create({
    model: FITPLAN_MODEL,
    max_tokens: 900,
    temperature: 0.3,
    system: `You are FreeTrust FitPlan check-in coach. Return one valid JSON object only. No markdown fences, comments, prose, or trailing commas. Shape: ${checkinShape}. ${fitPlanSafetyNote(input.profile)}`,
    messages: [{ role: 'user', content: `Profile: ${JSON.stringify(input.profile)}\nPlan: ${JSON.stringify(input.plan).slice(0, 8000)}\nWeekly check-in: ${JSON.stringify({ wins: input.wins, blockers: input.blockers, adherence: input.adherence })}` }],
  })
  const text = extractText(message)
  try {
    return parseJsonObject<Record<string, unknown>>(text)
  } catch (err) {
    console.warn('[FitPlan AI] initial check-in JSON parse failed; attempting repair:', err)
    return repairAndParseJsonObject<Record<string, unknown>>({ client, badJson: text, parseError: err, shape: checkinShape })
  }
}
