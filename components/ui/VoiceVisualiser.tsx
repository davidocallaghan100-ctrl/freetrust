'use client'

import { useEffect, useRef, useState } from 'react'

const BAR_COUNT = 48

export default function VoiceVisualiser() {
  const [active, setActive] = useState(false)
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.08))
  const animRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyserRef.current = analyser
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      setActive(true)
      animate(analyser)
    } catch {
      // fallback to simulated animation if mic denied
      setActive(true)
      simulateAnimation()
    }
  }

  const stop = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    audioCtxRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
    setActive(false)
    setBars(Array(BAR_COUNT).fill(0.08))
  }

  const animate = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const normalized = Array.from(data).map(v => Math.max(0.08, v / 255))
      setBars(normalized.slice(0, BAR_COUNT))
      animRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const simulateAnimation = () => {
    const tick = () => {
      setBars(prev =>
        prev.map((_, i) => {
          const wave = Math.sin(Date.now() / 200 + i * 0.4) * 0.3
          const rand = Math.random() * 0.2
          return Math.max(0.08, Math.min(1, 0.4 + wave + rand))
        })
      )
      animRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  useEffect(() => () => stop(), [])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Visualiser bars */}
      <div
        className="flex items-end gap-[3px] h-24 cursor-pointer select-none"
        onClick={active ? stop : startMic}
        title={active ? 'Click to stop' : 'Click to activate voice'}
      >
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-[5px] rounded-full transition-all duration-75"
            style={{
              height: `${h * 96}px`,
              background: active
                ? `hsl(${160 + i * 2}, 80%, ${45 + h * 30}%)`
                : `hsl(220, 15%, ${30 + i % 3 * 5}%)`,
              opacity: active ? 0.9 : 0.4,
            }}
          />
        ))}
      </div>

      {/* Label */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`}
        />
        <span className={active ? 'text-emerald-400' : 'text-zinc-500'}>
          {active ? 'Listening…' : 'Click visualiser to activate AI voice'}
        </span>
      </div>
    </div>
  )
}
