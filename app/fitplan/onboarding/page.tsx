'use client'

import { FormEvent, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#06131f', panel: '#0c1f30', card: '#10283b', line: 'rgba(148,163,184,.18)', text: '#f8fafc', muted: '#9fb2c7', green: '#10b981', gold: '#f4c96b', blue: '#38bdf8' }

function inputStyle() {
  return { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${C.line}`, borderRadius: 14, background: 'rgba(255,255,255,.05)', color: C.text, padding: '13px 14px', fontSize: 16, outline: 'none' }
}

function Label({ children }: { children: ReactNode }) {
  return <label style={{ display: 'block', color: C.muted, fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', margin: '18px 0 7px' }}>{children}</label>
}

function splitList(value: string) {
  return value.split(',').map(v => v.trim()).filter(Boolean)
}

export default function FitPlanOnboardingPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const payload = {
      display_name: String(form.get('display_name') || ''),
      goal: String(form.get('goal') || 'general_wellness'),
      experience_level: String(form.get('experience_level') || 'beginner'),
      training_days: Number(form.get('training_days') || 3),
      preferred_workout_minutes: Number(form.get('preferred_workout_minutes') || 35),
      equipment: splitList(String(form.get('equipment') || '')),
      dietary_preferences: splitList(String(form.get('dietary_preferences') || '')),
      allergies: splitList(String(form.get('allergies') || '')),
      injuries: String(form.get('injuries') || ''),
      doctor_clearance: String(form.get('doctor_clearance') || 'unknown'),
      birth_year: form.get('birth_year') ? Number(form.get('birth_year')) : null,
      height_cm: form.get('height_cm') ? Number(form.get('height_cm')) : null,
      weight: form.get('weight') ? Number(form.get('weight')) : null,
      weight_unit: unit,
      progress_photos_private: form.get('progress_photos_private') === 'on',
      share_updates_default: form.get('share_updates_default') === 'on',
      agreed_terms: form.get('agreed_terms') === 'on',
    }
    const res = await fetch('/api/fitplan/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not save FitPlan profile')
      setBusy(false)
      return
    }
    router.push('/fitplan/dashboard?generate=1')
  }

  return <main style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, rgba(16,185,129,.22), transparent 34%), ${C.bg}`, color: C.text, padding: '18px 14px 96px' }}>
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <a href="/fitplan/dashboard" style={{ color: C.blue, textDecoration: 'none', fontSize: 13, fontWeight: 800 }}>← FitPlan</a>
      <section style={{ marginTop: 16, padding: 20, borderRadius: 28, background: 'linear-gradient(145deg, rgba(16,185,129,.16), rgba(56,189,248,.08)), rgba(12,31,48,.92)', border: `1px solid ${C.line}`, boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'inline-flex', padding: '7px 11px', borderRadius: 999, color: C.gold, background: 'rgba(244,201,107,.12)', border: '1px solid rgba(244,201,107,.25)', fontSize: 12, fontWeight: 900 }}>AI FitPlan · Trust Coin powered</div>
        <h1 style={{ margin: '14px 0 8px', fontSize: 'clamp(32px, 10vw, 58px)', lineHeight: .95, letterSpacing: '-.06em' }}>Your private plan, built around real life.</h1>
        <p style={{ margin: 0, color: C.muted, lineHeight: 1.6 }}>Tell FitPlan enough to create a safe first week. Health fields are optional except accepting terms. Weight is stored internally in kg and displayed in your chosen unit.</p>
      </section>

      <form onSubmit={submit} style={{ marginTop: 16, padding: 18, borderRadius: 24, background: C.panel, border: `1px solid ${C.line}` }}>
        <Label>Name</Label><input name="display_name" placeholder="What should FitPlan call you?" style={inputStyle()} />
        <Label>Main goal</Label><select name="goal" style={inputStyle()} defaultValue="general_wellness"><option value="fat_loss">Fat loss</option><option value="muscle_gain">Muscle gain</option><option value="strength">Strength</option><option value="endurance">Endurance</option><option value="general_wellness">General wellness</option></select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div><Label>Level</Label><select name="experience_level" style={inputStyle()} defaultValue="beginner"><option>beginner</option><option>intermediate</option><option>advanced</option></select></div><div><Label>Days/week</Label><input name="training_days" type="number" min={1} max={7} defaultValue={3} style={inputStyle()} /></div></div>
        <Label>Workout minutes</Label><input name="preferred_workout_minutes" type="number" min={10} max={180} defaultValue={35} style={inputStyle()} />
        <Label>Equipment</Label><input name="equipment" placeholder="Dumbbells, bands, gym, none" style={inputStyle()} />
        <Label>Diet preferences</Label><input name="dietary_preferences" placeholder="Vegetarian, high protein, halal…" style={inputStyle()} />
        <Label>Allergies</Label><input name="allergies" placeholder="Nuts, dairy, gluten…" style={inputStyle()} />
        <Label>Injuries / limitations</Label><textarea name="injuries" rows={4} placeholder="Optional. Pain, movement limits, medical considerations…" style={{ ...inputStyle(), resize: 'vertical', lineHeight: 1.45 }} />
        <Label>Doctor clearance</Label><select name="doctor_clearance" style={inputStyle()} defaultValue="unknown"><option value="yes">Yes — cleared for exercise</option><option value="no">No — FitPlan should be extra cautious</option><option value="unknown">Not sure / prefer not to say</option></select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div><Label>Birth year</Label><input name="birth_year" type="number" placeholder="Optional" style={inputStyle()} /></div><div><Label>Height cm</Label><input name="height_cm" type="number" placeholder="Optional" style={inputStyle()} /></div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12 }}><div><Label>Weight</Label><input name="weight" type="number" step="0.1" placeholder="Optional" style={inputStyle()} /></div><div><Label>Unit</Label><select value={unit} onChange={e => setUnit(e.target.value as 'kg' | 'lb')} style={inputStyle()}><option value="kg">kg</option><option value="lb">lb</option></select></div></div>
        <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          <label style={{ display: 'flex', gap: 10, color: C.muted, fontSize: 14 }}><input name="progress_photos_private" type="checkbox" defaultChecked /> Keep progress photos private by default</label>
          <label style={{ display: 'flex', gap: 10, color: C.muted, fontSize: 14 }}><input name="share_updates_default" type="checkbox" /> Default progress updates to shareable (you still confirm every post)</label>
          <label style={{ display: 'flex', gap: 10, color: C.text, fontSize: 14, lineHeight: 1.45 }}><input name="agreed_terms" type="checkbox" required /> I understand FitPlan is wellness guidance, not medical advice. For medical concerns I will contact a qualified professional. Support: David@freetrust.co.</label>
        </div>
        {error && <div style={{ marginTop: 14, color: '#fecaca', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', padding: 12, borderRadius: 14 }}>{error}</div>}
        <button disabled={busy} style={{ marginTop: 18, width: '100%', minHeight: 52, border: 'none', borderRadius: 16, background: busy ? '#475569' : `linear-gradient(135deg, ${C.green}, #0ea5e9)`, color: '#fff', fontWeight: 950, fontSize: 16 }}>{busy ? 'Saving…' : 'Save and open dashboard'}</button>
      </form>
    </div>
  </main>
}
