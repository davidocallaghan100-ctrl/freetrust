export const FITPLAN_MODEL = process.env.FITPLAN_MODEL || 'claude-sonnet-4-6'

export const FITPLAN_COSTS = {
  planGeneration: 50,
  planGenerationWeekly: 50,
  planGenerationMonthly: 150,
  planGenerationQuarterly: 350,
  coachMessage: 5,
  checkinReward: 10,
  progressReward: 3,
} as const

export const FITPLAN_PLAN_DURATIONS = {
  weekly: { id: 'weekly', label: 'Weekly', days: 7, weeks: 1, cost: FITPLAN_COSTS.planGenerationWeekly },
  monthly: { id: 'monthly', label: 'Monthly', days: 28, weeks: 4, cost: FITPLAN_COSTS.planGenerationMonthly },
  quarterly: { id: 'quarterly', label: 'Quarterly', days: 91, weeks: 13, cost: FITPLAN_COSTS.planGenerationQuarterly },
} as const

export type FitPlanDuration = keyof typeof FITPLAN_PLAN_DURATIONS

export function normalizeFitPlanDuration(value: unknown): FitPlanDuration {
  return value === 'monthly' || value === 'quarterly' ? value : 'weekly'
}

export function getFitPlanDurationConfig(value: unknown) {
  return FITPLAN_PLAN_DURATIONS[normalizeFitPlanDuration(value)]
}

export const FITPLAN_TOPUP_PACKAGES = [
  { id: 'starter', label: 'Starter pack', trust: 250, amountCents: 499 },
  { id: 'momentum', label: 'Momentum pack', trust: 600, amountCents: 999 },
  { id: 'coach', label: 'Coach pack', trust: 1500, amountCents: 1999 },
] as const

export type FitPlanTopupPackageId = typeof FITPLAN_TOPUP_PACKAGES[number]['id']

export function getFitPlanTopupPackage(id: string | null | undefined) {
  return FITPLAN_TOPUP_PACKAGES.find(pkg => pkg.id === id) ?? null
}

export function kgFromInput(value: number | null | undefined, unit: 'kg' | 'lb' | string | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return unit === 'lb' ? Number((value * 0.45359237).toFixed(3)) : Number(value.toFixed(3))
}

export function displayWeightFromKg(value: number | null | undefined, unit: 'kg' | 'lb' | string | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return unit === 'lb' ? Number((value / 0.45359237).toFixed(1)) : Number(value.toFixed(1))
}

export function currentWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d.toISOString().slice(0, 10)
}
