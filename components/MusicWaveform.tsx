'use client'

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import {
  createFallbackMusicWaveform,
  MUSIC_WAVEFORM_PEAK_COUNT,
  normaliseMusicWaveform,
  type MusicWaveformPeaks,
} from '@/lib/audio/musicWaveform'

type MusicWaveformProps = {
  peaks?: MusicWaveformPeaks | null
  seed?: string
  progress: number
  playing: boolean
  analyser: AnalyserNode | null
  onSeek?: (fraction: number) => void
  label?: string
  height?: number
  className?: string
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  props: {
    peaks: MusicWaveformPeaks
    progress: number
    playing: boolean
    analyser: AnalyserNode | null
  },
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const centerY = height / 2
  const now = performance.now()
  const progress = clamp(props.progress)
  const progressX = width * progress

  ctx.clearRect(0, 0, width, height)

  let freqData: Uint8Array<ArrayBuffer> | null = null
  let timeData: Uint8Array<ArrayBuffer> | null = null
  let liveRms = 0
  let livePeak = 0
  if (props.analyser) {
    // Construct from a concrete ArrayBuffer so the DOM analyser typings do
    // not widen the view to ArrayBufferLike under newer TypeScript versions.
    freqData = new Uint8Array(new ArrayBuffer(props.analyser.frequencyBinCount))
    timeData = new Uint8Array(new ArrayBuffer(props.analyser.fftSize))
    props.analyser.getByteFrequencyData(freqData)
    props.analyser.getByteTimeDomainData(timeData)
    let sumSquares = 0
    for (let index = 0; index < timeData.length; index += 1) {
      const value = timeData[index] ?? 128
      const sample = (value - 128) / 128
      sumSquares += sample * sample
      livePeak = Math.max(livePeak, Math.abs(sample))
    }
    liveRms = timeData.length ? Math.sqrt(sumSquares / timeData.length) : 0
  }

  const samplePeak = (index: number, x: number) => {
    const base = props.peaks[index] ?? 0.12
    if (!props.playing || !freqData || !timeData) return base

    const bin = freqData[Math.min(freqData.length - 1, Math.floor((index / props.peaks.length) * freqData.length))] ?? 0
    const binAmp = bin / 255
    const organic = 0.88 + 0.16 * Math.sin(now / 125 + index * 0.73)
    // Live signal drives the modulation; the small organic term prevents
    // adjacent buckets from becoming a perfectly rigid equalizer.
    const reactive = 0.72 + liveRms * 1.8 + binAmp * 0.42
    const emphasis = x <= progressX ? 1.08 : 0.98
    return clamp(base * reactive * organic * emphasis, 0.05, 1)
  }

  const waveformPath = () => {
    ctx.beginPath()
    const count = props.peaks.length
    for (let i = 0; i < count; i += 1) {
      const x = (i / Math.max(1, count - 1)) * width
      const amp = Math.max(3, samplePeak(i, x) * height * 0.43)
      const eased = i === 0 || i === count - 1 ? amp * 0.72 : amp
      if (i === 0) ctx.moveTo(x, centerY - eased)
      else ctx.lineTo(x, centerY - eased)
    }
    for (let i = count - 1; i >= 0; i -= 1) {
      const x = (i / Math.max(1, count - 1)) * width
      const amp = Math.max(3, samplePeak(i, x) * height * 0.43)
      const eased = i === 0 || i === count - 1 ? amp * 0.72 : amp
      ctx.lineTo(x, centerY + eased)
    }
    ctx.closePath()
  }

  const drawPart = (start: number, end: number, color: string, glow: boolean) => {
    if (end <= start) return
    ctx.save()
    ctx.beginPath()
    ctx.rect(start, 0, end - start, height)
    ctx.clip()
    if (glow) {
      ctx.shadowColor = 'rgba(45, 212, 191, 0.9)'
      ctx.shadowBlur = 12 + livePeak * 18
    }
    ctx.fillStyle = color
    waveformPath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = color
    ctx.lineWidth = 1.3
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()
  }

  drawPart(0, width, 'rgba(148, 163, 184, 0.36)', false)
  drawPart(0, progressX, 'rgba(56, 189, 248, 0.94)', props.playing)

  // A brighter playhead makes the left-to-right progression obvious even
  // while a quiet portion of the track is playing.
  if (progress > 0 && progress < 1) {
    ctx.save()
    ctx.strokeStyle = props.playing ? 'rgba(167, 243, 208, 0.95)' : 'rgba(186, 230, 253, 0.82)'
    ctx.lineWidth = 2
    ctx.shadowColor = props.playing ? 'rgba(45, 212, 191, 0.9)' : 'transparent'
    ctx.shadowBlur = props.playing ? 8 : 0
    ctx.beginPath()
    ctx.moveTo(progressX, 8)
    ctx.lineTo(progressX, height - 8)
    ctx.stroke()
    ctx.restore()
  }
}

export default function MusicWaveform({
  peaks,
  seed = 'freetrust-music',
  progress,
  playing,
  analyser,
  onSeek,
  label = 'Seek track position',
  height = 96,
  className,
}: MusicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const propsRef = useRef({
    peaks: normaliseMusicWaveform(peaks) ?? createFallbackMusicWaveform(seed, MUSIC_WAVEFORM_PEAK_COUNT),
    progress,
    playing,
    analyser,
  })

  useEffect(() => {
    propsRef.current = {
      peaks: normaliseMusicWaveform(peaks) ?? createFallbackMusicWaveform(seed, MUSIC_WAVEFORM_PEAK_COUNT),
      progress,
      playing,
      analyser,
    }
  }, [peaks, seed, progress, playing, analyser])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frame = 0
    const draw = () => {
      drawWaveform(canvas, propsRef.current)
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const seekFromClientX = (clientX: number, target: HTMLDivElement) => {
    if (!onSeek) return
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0) return
    onSeek(clamp((clientX - rect.left) / rect.width))
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    seekFromClientX(event.clientX, event.currentTarget)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : clamp(progress + (event.key === 'ArrowRight' ? 0.02 : -0.02))
    onSeek(next)
  }

  return (
    <div
      className={className}
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? label : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(clamp(progress) * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? handleClick : undefined}
      onKeyDown={onSeek ? handleKeyDown : undefined}
      style={{ position: 'relative', width: '100%', height, cursor: onSeek ? 'pointer' : 'default', touchAction: onSeek ? 'none' : undefined }}
    >
      <canvas
        ref={canvasRef}
        width={960}
        height={220}
        aria-hidden="true"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
