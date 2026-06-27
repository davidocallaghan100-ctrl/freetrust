'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#06131f', panel: '#0c1f30', card: '#10283b', card2: '#0b1a29', ink: '#050b16', line: 'rgba(148,163,184,.18)', text: '#f8fafc', muted: '#9fb2c7', green: '#10b981', gold: '#f4c96b', blue: '#38bdf8', cyan: '#67e8f9', red: '#fb7185' }
type FitData = { profile: any; activePlan: any; progress: any[]; checkins: any[]; messages: any[]; trustBalance: number; costs: Record<string, number> }

function Card({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) { return <section style={{ background: 'rgba(12,31,48,.92)', border: `1px solid ${C.line}`, borderRadius: 24, padding: 16, boxShadow: '0 18px 50px rgba(0,0,0,.24)', ...style }}>{children}</section> }
function Pill({ children, color = C.blue }: { children: ReactNode; color?: string }) { return <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '6px 9px', color, background: `${color}18`, border: `1px solid ${color}36`, fontSize: 11, fontWeight: 900 }}>{children}</span> }
function inputStyle() { return { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${C.line}`, borderRadius: 14, background: 'rgba(255,255,255,.05)', color: C.text, padding: '12px 13px', fontSize: 16, outline: 'none' } }

export default function FitPlanDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<FitData | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [range, setRange] = useState<'daily'|'weekly'|'monthly'|'quarterly'>('daily'); const [coachText, setCoachText] = useState('')
  async function load() { setLoading(true); const res = await fetch('/api/fitplan/profile', { cache: 'no-store' }); if (res.status === 401) { router.push('/login?redirect=/fitplan/dashboard'); return } const json = await res.json(); setData(json); setLoading(false); if (!json.profile) router.push('/fitplan/onboarding') }
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const shouldGenerate = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('generate') === '1'
    if (shouldGenerate && data?.profile && !data.activePlan && !busy) void generatePlan()
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const plan = data?.activePlan?.plan_json
  const progressScore = useMemo(() => { const rows = data?.progress ?? []; if (!rows.length) return 0; const completed = rows.filter(r => r.workout_completed || r.nutrition_hit).length; return Math.round((completed / rows.length) * 100) }, [data])
  const coachPrompts = useMemo(() => {
    const goals = (data?.profile?.goals ?? [data?.profile?.goal ?? 'general_wellness']).filter(Boolean).map((g: string) => String(g).replace(/_/g, ' '))
    const mainGoal = goals[0] ?? 'fitness'
    return [
      `Build today's ${mainGoal} session around my plan`,
      'Swap this workout for a home version',
      'Give me three meal ideas for this week',
      'Create a recovery plan for sore legs',
    ]
  }, [data?.profile])
  async function generatePlan() { setBusy('generate'); setError(''); const res = await fetch('/api/fitplan/generate-plan', { method: 'POST' }); const json = await res.json().catch(() => ({})); setBusy(''); if (!res.ok) { setError(json.error || 'Could not generate plan'); return } await load() }
  async function topup(id: string) { setBusy(`topup-${id}`); const res = await fetch('/api/fitplan/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packageId: id }) }); const json = await res.json().catch(() => ({})); setBusy(''); if (json.url) window.location.href = json.url; else setError(json.error || 'Could not start top-up') }
  async function coach(e: FormEvent) { e.preventDefault(); if (!coachText.trim()) return; setBusy('coach'); setError(''); const res = await fetch('/api/fitplan/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: coachText }) }); const json = await res.json().catch(() => ({})); setBusy(''); if (!res.ok) { setError(json.error || 'Coach failed'); return } setCoachText(''); await load() }
  async function checkin(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = new FormData(e.currentTarget); setBusy('checkin'); const res = await fetch('/api/fitplan/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wins: String(form.get('wins') || ''), blockers: String(form.get('blockers') || ''), adherence: Number(form.get('adherence') || 0), share_to_feed: form.get('share_to_feed') === 'on' }) }); const json = await res.json().catch(() => ({})); setBusy(''); if (!res.ok) { setError(json.error || 'Check-in failed'); return } ; (e.currentTarget as HTMLFormElement).reset(); await load() }
  async function progress(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = new FormData(e.currentTarget); setBusy('progress'); const res = await fetch('/api/fitplan/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weight: form.get('weight') ? Number(form.get('weight')) : null, weight_unit: data?.profile?.weight_unit ?? 'kg', energy: Number(form.get('energy') || 0), mood: Number(form.get('mood') || 0), sleep_hours: Number(form.get('sleep_hours') || 0), workout_completed: form.get('workout_completed') === 'on', nutrition_hit: form.get('nutrition_hit') === 'on', notes: String(form.get('notes') || ''), share_to_feed: form.get('share_to_feed') === 'on' }) }); const json = await res.json().catch(() => ({})); setBusy(''); if (!res.ok) { setError(json.error || 'Progress save failed'); return } ; (e.currentTarget as HTMLFormElement).reset(); await load() }

  if (loading) return <main style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'grid', placeItems: 'center' }}>Loading FitPlan…</main>
  return <main style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, rgba(16,185,129,.18), transparent 35%), radial-gradient(circle at 90% 10%, rgba(56,189,248,.16), transparent 28%), ${C.bg}`, color: C.text, padding: '14px 12px 104px' }}>
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <section style={{ borderRadius: 30, padding: 18, background: 'linear-gradient(135deg, rgba(16,185,129,.18), rgba(56,189,248,.09)), rgba(12,31,48,.94)', border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><Pill color={C.gold}>FitPlan 🏋️</Pill><Pill color={C.green}>₮{data?.trustBalance ?? 0} Trust Coins</Pill></div>
        <h1 style={{ margin: '16px 0 8px', fontSize: 'clamp(34px, 10vw, 64px)', lineHeight: .92, letterSpacing: '-.065em' }}>{data?.profile?.display_name ? `${data.profile.display_name}'s plan` : 'Your FitPlan'}</h1>
        <p style={{ margin: 0, color: C.muted, lineHeight: 1.55, maxWidth: 680 }}>Personal training, nutrition, check-ins, and coach guidance powered by Trust Coins. Progress photos stay private by default, and feed sharing only happens when you tick the box.</p>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 16 }}>{(['daily','weekly','monthly','quarterly'] as const).map(r => <button key={r} onClick={() => setRange(r)} style={{ border: `1px solid ${range === r ? C.green : C.line}`, background: range === r ? 'rgba(16,185,129,.18)' : 'rgba(255,255,255,.04)', color: range === r ? C.text : C.muted, borderRadius: 999, padding: '9px 13px', fontWeight: 900, textTransform: 'capitalize' }}>{r}</button>)}</div>
      </section>
      {error && <div style={{ marginTop: 12, color: '#fecaca', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', padding: 12, borderRadius: 16 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
        <Card><div style={{ color: C.muted, fontSize: 12, fontWeight: 900 }}>TODAY</div><h2 style={{ margin: '8px 0', fontSize: 24 }}>{plan?.workouts?.[0]?.focus ?? 'Generate your first plan'}</h2><p style={{ color: C.muted, lineHeight: 1.5 }}>{plan?.workouts?.[0]?.blocks?.slice(0, 2).join(' · ') ?? `AI plan generation costs ₮${data?.costs?.planGeneration ?? 50}.`}</p><button onClick={generatePlan} disabled={busy === 'generate'} style={{ width: '100%', minHeight: 46, border: 'none', borderRadius: 14, background: C.green, color: '#fff', fontWeight: 950 }}>{busy === 'generate' ? 'Generating…' : plan ? 'Regenerate plan' : 'Generate plan'}</button></Card>
        <Card><div style={{ color: C.muted, fontSize: 12, fontWeight: 900 }}>{range.toUpperCase()} MOMENTUM</div><div style={{ margin: '14px 0', height: 12, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ width: `${progressScore}%`, height: '100%', background: `linear-gradient(90deg, ${C.green}, ${C.blue})` }} /></div><div style={{ fontSize: 36, fontWeight: 950 }}>{progressScore}%</div><p style={{ color: C.muted }}>Based only on your real FitPlan logs. No sample data shown.</p></Card>
        <Card><div style={{ color: C.muted, fontSize: 12, fontWeight: 900 }}>SAFETY</div><h3 style={{ margin: '8px 0', color: data?.profile?.doctor_clearance === 'no' ? C.gold : C.text }}>{data?.profile?.doctor_clearance === 'no' ? 'GP clearance recommended' : 'Conservative coaching'}</h3><p style={{ color: C.muted, lineHeight: 1.5 }}>{data?.profile?.doctor_clearance === 'no' ? 'The coach will stay gentle and remind you to get qualified clearance before training.' : 'FitPlan avoids diagnosis and escalates medical concerns to qualified professionals.'}</p><a href="/fitplan/onboarding" style={{ color: C.blue, fontWeight: 900 }}>Edit profile →</a></Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, .75fr)', gap: 12, marginTop: 12 }} className="fitplan-grid">
        <Card><h2 style={{ marginTop: 0 }}>7-day plan</h2>{plan ? <div style={{ display: 'grid', gap: 10 }}>{(plan.workouts ?? []).map((w: any, i: number) => <div key={`${w.day}-${i}`} style={{ padding: 12, borderRadius: 16, background: C.card2, border: `1px solid ${C.line}` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{w.day} · {w.focus}</strong><Pill color={C.gold}>{w.durationMinutes} min</Pill></div><p style={{ color: C.muted, margin: '8px 0 0', lineHeight: 1.45 }}>{(w.blocks ?? []).join(' · ')}</p></div>)}</div> : <p style={{ color: C.muted }}>No active plan yet. Generate a plan to fill this section.</p>}</Card>
        <Card><h2 style={{ marginTop: 0 }}>Credits</h2><p style={{ color: C.muted }}>Plans and coach messages spend Trust Coins. Check-ins and logs can earn small Trust rewards.</p>{[['starter','₮250','€4.99'],['momentum','₮600','€9.99'],['coach','₮1500','€19.99']].map(([id, trust, price]) => <button key={id} onClick={() => topup(id)} disabled={busy === `topup-${id}`} style={{ width: '100%', marginTop: 8, minHeight: 44, borderRadius: 14, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,.05)', color: C.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', fontWeight: 900 }}><span>{trust}</span><span>{price}</span></button>)}</Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
        <Card style={{ padding: 0, overflow: 'hidden', background: `radial-gradient(circle at 50% 22%, rgba(103,232,249,.18), transparent 28%), radial-gradient(circle at 85% 12%, rgba(16,185,129,.14), transparent 24%), ${C.ink}`, borderColor: 'rgba(103,232,249,.18)' }}>
          <div style={{ minHeight: 560, display: 'flex', flexDirection: 'column', padding: 18, gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" aria-label="FitPlan menu" style={{ width: 56, height: 56, borderRadius: 999, border: '1px solid rgba(148,163,184,.18)', background: 'rgba(15,23,42,.62)', color: C.text, fontSize: 24, boxShadow: 'inset 0 0 22px rgba(148,163,184,.08)' }}>☰</button>
              <div style={{ width: 56, height: 56, borderRadius: 999, border: '1px solid rgba(103,232,249,.28)', background: 'rgba(8,47,73,.45)', color: C.cyan, display: 'grid', placeItems: 'center', boxShadow: '0 0 28px rgba(56,189,248,.18)' }}>🏋️</div>
            </div>
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '18px 0' }}>
              <div>
                <div style={{ width: 104, height: 104, margin: '0 auto 18px', borderRadius: 30, display: 'grid', placeItems: 'center', color: C.cyan, fontSize: 54, textShadow: `0 0 32px ${C.cyan}`, background: 'radial-gradient(circle, rgba(103,232,249,.18), transparent 68%)' }}>🏋️</div>
                <h2 style={{ margin: 0, fontSize: 'clamp(36px, 10vw, 58px)', letterSpacing: '-.06em', lineHeight: .92 }}>FitPlan Coach</h2>
                <p style={{ color: C.muted, fontSize: 18, margin: '12px 0 0' }}>Ready to train smarter?</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, margin: '0 -4px' }}>
              {coachPrompts.map((prompt, idx) => <button key={prompt} type="button" onClick={() => setCoachText(prompt)} style={{ minWidth: 210, minHeight: 74, textAlign: 'left', borderRadius: 22, border: `1px solid ${idx === 1 ? 'rgba(103,232,249,.42)' : C.line}`, background: idx === 1 ? 'rgba(8,47,73,.72)' : 'rgba(15,23,42,.66)', color: C.text, padding: '12px 14px', fontWeight: 850, fontSize: 16, boxShadow: idx === 1 ? '0 0 24px rgba(56,189,248,.16)' : 'none' }}><span style={{ color: C.cyan, marginRight: 8 }}>{idx === 0 ? '▣' : idx === 1 ? '⇄' : idx === 2 ? '◌' : '✦'}</span>{prompt}</button>)}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 8, paddingRight: 2 }}>
              {(data?.messages ?? []).map(m => <div key={m.id} style={{ justifySelf: m.role === 'user' ? 'end' : 'start', maxWidth: '92%', padding: '11px 13px', borderRadius: 18, background: m.role === 'user' ? 'rgba(16,185,129,.18)' : 'rgba(15,23,42,.82)', border: `1px solid ${m.role === 'user' ? 'rgba(16,185,129,.24)' : C.line}`, color: m.role === 'user' ? C.text : C.muted, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{m.content}</div>)}
              {!(data?.messages ?? []).length && <p style={{ color: C.muted, margin: 0, lineHeight: 1.5 }}>Tap an idea or ask for a workout swap, meal plan, recovery adjustment, or goal-specific progression. Coach messages cost ₮{data?.costs?.coachMessage ?? 5}.</p>}
            </div>
            <form onSubmit={coach} style={{ border: `1px solid rgba(148,163,184,.22)`, background: 'rgba(15,23,42,.88)', borderRadius: 26, padding: 10, display: 'grid', gap: 10 }}>
              <textarea value={coachText} onChange={e => setCoachText(e.target.value)} rows={2} placeholder="Ask FitPlan to build, swap, fuel, recover, or progress…" style={{ ...inputStyle(), border: 'none', background: 'transparent', resize: 'none', padding: '10px 12px' }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button type="button" onClick={() => setCoachText('')} style={{ width: 48, height: 48, borderRadius: 999, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,.03)', color: C.text, fontSize: 26 }}>+</button><Pill color={C.cyan}>🏋️ FitPlan Agent</Pill><button disabled={busy === 'coach'} style={{ marginLeft: 'auto', width: 54, height: 54, border: 'none', borderRadius: 999, background: C.text, color: C.ink, fontWeight: 950, fontSize: 18 }}>{busy === 'coach' ? '…' : '▶'}</button></div>
            </form>
          </div>
        </Card>
        <Card><h2 style={{ marginTop: 0 }}>Weekly check-in</h2><form onSubmit={checkin} style={{ display: 'grid', gap: 9 }}><textarea name="wins" rows={3} placeholder="Wins this week" style={inputStyle()} /><textarea name="blockers" rows={3} placeholder="Blockers / adjustments" style={inputStyle()} /><input name="adherence" type="number" min={0} max={100} placeholder="Adherence %" style={inputStyle()} /><label style={{ color: C.muted, fontSize: 13 }}><input type="checkbox" name="share_to_feed" /> Share to newsfeed after saving</label><button disabled={busy === 'checkin'} style={{ minHeight: 46, border: 'none', borderRadius: 14, background: C.green, color: '#fff', fontWeight: 950 }}>{busy === 'checkin' ? 'Checking in…' : `Check in · earn ₮${data?.costs?.checkinReward ?? 10}`}</button></form></Card>
        <Card><h2 style={{ marginTop: 0 }}>Progress log</h2><form onSubmit={progress} style={{ display: 'grid', gap: 9 }}><input name="weight" type="number" step="0.1" placeholder={`Weight (${data?.profile?.weight_unit ?? 'kg'})`} style={inputStyle()} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}><input name="energy" type="number" min={1} max={10} placeholder="Energy" style={inputStyle()} /><input name="mood" type="number" min={1} max={10} placeholder="Mood" style={inputStyle()} /><input name="sleep_hours" type="number" step="0.1" placeholder="Sleep" style={inputStyle()} /></div><textarea name="notes" rows={3} placeholder="Notes" style={inputStyle()} /><label style={{ color: C.muted, fontSize: 13 }}><input type="checkbox" name="workout_completed" /> Workout completed</label><label style={{ color: C.muted, fontSize: 13 }}><input type="checkbox" name="nutrition_hit" /> Nutrition target hit</label><label style={{ color: C.muted, fontSize: 13 }}><input type="checkbox" name="share_to_feed" /> Share to newsfeed after saving</label><button disabled={busy === 'progress'} style={{ minHeight: 46, border: 'none', borderRadius: 14, background: C.gold, color: '#172033', fontWeight: 950 }}>{busy === 'progress' ? 'Saving…' : `Save log · earn ₮${data?.costs?.progressReward ?? 3}`}</button></form></Card>
      </div>
    </div>
    <style>{`@media(max-width:760px){.fitplan-grid{grid-template-columns:1fr!important}} input::placeholder, textarea::placeholder{color:#718096} select option{background:#0c1f30;color:#f8fafc}`}</style>
  </main>
}
