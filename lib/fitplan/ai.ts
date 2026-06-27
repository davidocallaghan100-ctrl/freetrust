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

const GOAL_LABELS: Record<string, string> = {
  fat_loss: 'fat loss',
  muscle_gain: 'muscle gain',
  strength: 'strength',
  endurance: 'endurance',
  general_wellness: 'general wellness',
  mobility: 'mobility',
  energy: 'more energy',
  nutrition: 'better nutrition',
}

function goalLabel(goal: string | null | undefined) {
  return GOAL_LABELS[String(goal || '').trim()] ?? String(goal || 'general wellness').replace(/_/g, ' ')
}

function splitList(values: string[] | null | undefined, fallback: string[]) {
  return Array.isArray(values) && values.length ? values : fallback
}

function buildFastFitPlan(profile: FitPlanProfile): FitPlanAiPlan {
  const goals = splitList(profile.goals, [profile.goal]).map(goalLabel).slice(0, 5)
  const goalText = goals.length > 1 ? `${goals.slice(0, -1).join(', ')} and ${goals.at(-1)}` : goals[0]
  const level = profile.experience_level || 'beginner'
  const days = Math.min(7, Math.max(1, Number(profile.training_days) || 3))
  const minutes = Math.min(90, Math.max(10, Number(profile.preferred_workout_minutes) || 35))
  const equipment = splitList(profile.equipment, ['bodyweight']).join(', ')
  const hasInjuries = Boolean(profile.injuries?.trim())
  const noClearance = profile.doctor_clearance === 'no'
  const gentle = noClearance || hasInjuries || level === 'beginner'

  const focusPool = [
    goals.includes('strength') || goals.includes('muscle gain') ? 'Strength foundation' : 'Full-body foundation',
    goals.includes('endurance') || goals.includes('fat loss') ? 'Low-impact conditioning' : 'Zone 2 cardio',
    goals.includes('mobility') ? 'Mobility and joint control' : 'Mobility reset',
    goals.includes('better nutrition') || goals.includes('fat loss') ? 'Nutrition prep walk' : 'Core and posture',
    goals.includes('more energy') ? 'Energy primer' : 'Technique practice',
  ]
  const trainingBlocks = [
    `Warm-up: 5 minutes easy movement, breathing, and joint circles`,
    gentle
      ? `Main: 2 gentle rounds using ${equipment}; stop well before pain or breathlessness`
      : `Main: 3 focused rounds using ${equipment}; keep 2 reps in reserve`,
    goals.includes('fat loss') || goals.includes('endurance')
      ? `Finisher: 8-12 minutes conversational-pace cardio or brisk walking`
      : `Finisher: 6-8 minutes core, carries, or controlled tempo work`,
    `Cooldown: 5 minutes stretching plus note energy, mood, and any warning signs`,
  ]

  const workouts = Array.from({ length: 7 }, (_, index) => {
    const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]
    const isTraining = index < days
    const focus = isTraining ? focusPool[index % focusPool.length] : (index % 2 ? 'Recovery walk' : 'Rest and mobility')
    return {
      day,
      focus,
      durationMinutes: isTraining ? minutes : Math.min(25, Math.max(10, Math.round(minutes * 0.5))),
      blocks: isTraining ? trainingBlocks : [
        'Easy walk, light mobility, or complete rest',
        'Prepare one simple protein-forward meal for tomorrow',
        'Sleep wind-down: screens down, hydrate, and plan the next session',
      ],
      modifications: [
        noClearance ? 'Get GP or qualified-professional clearance before increasing intensity.' : 'Keep intensity conversational if you feel unusually tired.',
        hasInjuries ? 'Avoid movements that aggravate your reported limitations; choose pain-free ranges.' : 'Swap any painful movement for walking, mobility, or a lighter variation.',
      ],
    }
  })

  return {
    summary: `A fast-start 7-day FitPlan for ${goalText}. It balances ${days} training day${days === 1 ? '' : 's'}, recovery, nutrition, and safe progression so you can begin right away.`,
    safety: [
      'This is general wellness information only, not medical advice or diagnosis.',
      noClearance ? 'Because you selected no doctor clearance, keep sessions gentle and speak with a GP or qualified professional before progressing.' : 'Stop if you feel pain, dizziness, chest pain, unusual shortness of breath, or other concerning symptoms.',
      hasInjuries ? 'Use pain-free ranges and get qualified physio/medical guidance for injuries or limitations.' : 'Progress only when the current week feels controlled and repeatable.',
    ],
    dailyTargets: {
      steps: goals.includes('fat loss') || goals.includes('endurance') ? '7,000-10,000 comfortable steps' : '6,000-8,000 comfortable steps',
      hydration: '2-3 litres water, adjusted for body size, sweat, and climate',
      protein: goals.includes('muscle gain') || goals.includes('strength') ? 'Protein at each meal; include a post-training serving' : 'Protein and fibre at each main meal',
      sleep: '7-9 hours where possible; protect a consistent wind-down',
    },
    workouts,
    nutrition: {
      approach: goals.includes('fat loss')
        ? 'Build a modest, sustainable calorie deficit with protein, vegetables, and planned treats rather than extreme restriction.'
        : goals.includes('muscle gain')
          ? 'Support training with protein, quality carbohydrates, and enough total food to recover.'
          : 'Keep meals simple: protein, plants, slow carbs, healthy fats, and hydration.',
      meals: [
        'Breakfast idea: Greek yoghurt or eggs with fruit/oats and water.',
        'Lunch idea: protein bowl with greens, potatoes/rice, beans or lean protein.',
        'Dinner idea: simple plate of protein, colourful vegetables, and slow carbs.',
        'Snack idea: fruit plus nuts, yoghurt, cottage cheese, or a smoothie.',
      ],
      prepTips: [
        'Batch-cook one protein and one carbohydrate twice per week.',
        'Keep a fast fallback meal ready for busy days.',
        'Plan shopping around the next three training days.',
      ],
      avoid: [
        'Extreme dieting, dehydration tactics, or unsafe supplements.',
        'Training through pain or symptoms to chase a streak.',
      ],
    },
    habits: [
      'Log energy, mood, sleep, and workout completion after each session.',
      'Use the Coach to swap workouts around real-life constraints.',
      'Review the week every Sunday and repeat what worked.',
    ],
    checkinQuestions: [
      'Which session felt best and why?',
      'What blocked consistency this week?',
      'What should FitPlan make easier next week?',
    ],
  }
}

export async function generateFitPlan(profile: FitPlanProfile): Promise<FitPlanAiPlan> {
  if (process.env.FITPLAN_AI_PLAN_GENERATION !== 'true') return buildFastFitPlan(profile)
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
