export type FitPlanCalendarRange = 'daily' | 'weekly' | 'monthly' | 'quarterly'

type PlanLike = {
  id?: string
  duration?: string | null
  starts_on?: string | null
  ends_on?: string | null
  plan_json?: any
  total_workouts?: number | null
  total_meals?: number | null
}

type CompletionLike = {
  id?: string
  item_kind?: 'workout' | 'meal' | string
  item_index?: number
  item_label?: string | null
  scheduled_on?: string | null
  completed_on?: string | null
  completed_at?: string | null
  is_completed?: boolean
}

type ProgressLike = {
  logged_on?: string | null
  energy?: number | null
  mood?: number | null
  sleep_hours?: number | null
  weight_kg?: number | null
  workout_completed?: boolean | null
  nutrition_hit?: boolean | null
}

type CheckinLike = {
  week_start?: string | null
  adherence?: number | null
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function addDateDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return todayKey(date)
}

export function daysBetween(start: string, end: string) {
  const out: string[] = []
  const s = new Date(`${start}T00:00:00.000Z`)
  const e = new Date(`${end}T00:00:00.000Z`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return out
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) out.push(todayKey(d))
  return out
}

export function resolvePlanWindow(plan: PlanLike | null | undefined) {
  const json = plan?.plan_json && typeof plan.plan_json === 'object' ? plan.plan_json : {}
  const workouts = Array.isArray(json.workouts) ? json.workouts : []
  const firstWorkoutDate = workouts.map((w: any) => typeof w?.scheduledDate === 'string' ? w.scheduledDate : '').find(Boolean)
  const durationDays = Number(json.durationDays || plan?.total_workouts || workouts.length || 7)
  const start = String(plan?.starts_on || json.startDate || firstWorkoutDate || todayKey()).slice(0, 10)
  const end = String(plan?.ends_on || json.endDate || addDateDays(start, Math.max(0, durationDays - 1))).slice(0, 10)
  return { start, end, days: daysBetween(start, end) }
}

export function completionIsDone(value: unknown) {
  return value === true || (Boolean(value) && typeof value === 'object' && (value as { completed?: unknown }).completed === true)
}

function completionDate(value: unknown) {
  if (value && typeof value === 'object') {
    const v = value as { completedOn?: unknown; completedAt?: unknown }
    if (typeof v.completedOn === 'string') return v.completedOn.slice(0, 10)
    if (typeof v.completedAt === 'string') return v.completedAt.slice(0, 10)
  }
  return null
}

export function scheduledWorkoutDate(workout: any, index: number, start: string) {
  return typeof workout?.scheduledDate === 'string' ? workout.scheduledDate.slice(0, 10) : addDateDays(start, index)
}

export function buildFitPlanCalendar(input: {
  plan: PlanLike | null | undefined
  completions?: CompletionLike[] | null
  progress?: ProgressLike[] | null
  checkins?: CheckinLike[] | null
}) {
  const plan = input.plan
  const json = plan?.plan_json && typeof plan.plan_json === 'object' ? plan.plan_json : {}
  const workouts = Array.isArray(json.workouts) ? json.workouts : []
  const meals = Array.isArray(json?.nutrition?.meals) ? json.nutrition.meals : []
  const { start, end, days } = resolvePlanWindow(plan)
  const events = (input.completions ?? []).filter(event => event?.is_completed !== false)
  const progress = input.progress ?? []
  const checkins = input.checkins ?? []

  const completedWorkoutKeys = new Set(events.filter(e => e.item_kind === 'workout').map(e => String(e.item_index)))
  const completedMealKeys = new Set(events.filter(e => e.item_kind === 'meal').map(e => String(e.item_index)))

  const legacyWorkoutCompletions = json.completedWorkouts && typeof json.completedWorkouts === 'object' ? json.completedWorkouts : {}
  const legacyMealCompletions = json.completedMeals && typeof json.completedMeals === 'object' ? json.completedMeals : {}
  Object.entries(legacyWorkoutCompletions).forEach(([key, value]) => { if (completionIsDone(value)) completedWorkoutKeys.add(key) })
  Object.entries(legacyMealCompletions).forEach(([key, value]) => { if (completionIsDone(value)) completedMealKeys.add(key) })

  const dayRows = days.map(date => {
    const dayIndex = days.indexOf(date)
    const dayWorkouts = workouts
      .map((workout: any, index: number) => ({ workout, index, date: scheduledWorkoutDate(workout, index, start) }))
      .filter((item: { date: string }) => item.date === date)
      .map((item: { workout: any; index: number }) => ({ kind: 'workout' as const, index: item.index, label: item.workout?.focus ?? `Workout ${item.index + 1}`, completed: completedWorkoutKeys.has(String(item.index)) }))
    const dayMeals = meals.map((meal: string, index: number) => ({ kind: 'meal' as const, index, label: String(meal), completed: completedMealKeys.has(String(index)) && events.some(e => e.item_kind === 'meal' && e.item_index === index && (e.completed_on || '').slice(0, 10) === date) }))
    const dayEvents = events.filter(e => (e.completed_on || e.completed_at || '').slice(0, 10) === date)
    return {
      date,
      dayIndex,
      scheduled: [...dayWorkouts, ...dayMeals],
      completions: dayEvents,
      progress: progress.filter(row => (row.logged_on || '').slice(0, 10) === date),
      checkins: checkins.filter(row => (row.week_start || '').slice(0, 10) === date),
    }
  })

  const totalWorkouts = workouts.length
  const totalMeals = meals.length
  const workoutDone = completedWorkoutKeys.size
  const mealDone = completedMealKeys.size
  const totalTasks = totalWorkouts + totalMeals
  const totalDone = workoutDone + mealDone
  const avg = (values: Array<number | null | undefined>) => {
    const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    return nums.length ? Number((nums.reduce((sum, v) => sum + v, 0) / nums.length).toFixed(1)) : null
  }
  const weights = progress.filter(row => typeof row.weight_kg === 'number').sort((a, b) => String(a.logged_on).localeCompare(String(b.logged_on)))
  const activeDates = new Set<string>()
  events.forEach(event => { const key = (event.completed_on || event.completed_at || '').slice(0, 10); if (key) activeDates.add(key) })
  progress.forEach(row => { const key = (row.logged_on || '').slice(0, 10); if (key && (row.workout_completed || row.nutrition_hit)) activeDates.add(key) })
  let currentStreak = 0
  for (let key = todayKey(); activeDates.has(key); key = addDateDays(key, -1)) currentStreak += 1
  let bestStreak = 0
  let running = 0
  days.forEach(date => { if (activeDates.has(date)) { running += 1; bestStreak = Math.max(bestStreak, running) } else running = 0 })

  return {
    start,
    end,
    days: dayRows,
    analytics: {
      totalTasks,
      totalDone,
      completionRate: totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0,
      workoutCompletionRate: totalWorkouts ? Math.round((workoutDone / totalWorkouts) * 100) : 0,
      mealCompletionRate: totalMeals ? Math.round((mealDone / totalMeals) * 100) : 0,
      workoutDone,
      totalWorkouts,
      mealDone,
      totalMeals,
      currentStreak,
      bestStreak,
      logsCount: progress.length,
      avgEnergy: avg(progress.map(row => row.energy)),
      avgMood: avg(progress.map(row => row.mood)),
      avgSleep: avg(progress.map(row => typeof row.sleep_hours === 'number' ? row.sleep_hours : row.sleep_hours ? Number(row.sleep_hours) : null)),
      latestWeightKg: weights.at(-1)?.weight_kg ?? null,
      weightDeltaKg: weights.length > 1 && typeof weights[0].weight_kg === 'number' && typeof weights.at(-1)?.weight_kg === 'number'
        ? Number(((weights.at(-1)!.weight_kg as number) - (weights[0].weight_kg as number)).toFixed(1))
        : null,
      adherenceAverage: avg(checkins.map(row => row.adherence)),
    },
  }
}

export function planCompletionValue(value: unknown) {
  return completionIsDone(value)
}

export function planCompletionDate(value: unknown) {
  return completionDate(value)
}
