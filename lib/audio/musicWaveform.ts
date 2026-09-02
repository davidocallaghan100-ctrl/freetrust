/**
 * Small, bounded waveform helpers for Music posts.
 *
 * Uploaded files are decoded once in the composer so the feed can render a
 * SoundCloud-style left-to-right waveform without decoding the whole track on
 * every card. The persisted representation is intentionally tiny: a maximum
 * of 160 normalised peaks in the range 0..1.
 */

export const MUSIC_WAVEFORM_PEAK_COUNT = 160

export type MusicWaveformPeaks = number[]

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

/** Parse and bound a value received from a form field or Supabase JSONB. */
export function normaliseMusicWaveform(raw: unknown): MusicWaveformPeaks | null {
  let value: unknown = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!Array.isArray(value)) return null

  const peaks = value
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    .slice(0, MUSIC_WAVEFORM_PEAK_COUNT)
    .map(item => clamp(item))

  return peaks.length >= 8 ? peaks : null
}

/**
 * A deterministic visual fallback for remote preview URLs whose provider
 * does not allow us to fetch/decode the audio ahead of time. This is not
 * presented as measured source data: once playback starts, the live
 * AnalyserNode modulates it with the actual audio signal.
 */
export function createFallbackMusicWaveform(seed: string, count = MUSIC_WAVEFORM_PEAK_COUNT): MusicWaveformPeaks {
  let state = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }

  const peaks: number[] = []
  let previous = 0.42
  for (let i = 0; i < count; i += 1) {
    // Deterministic pseudo-randomness gives an organic contour without
    // changing shape on every render or pretending to be track metadata.
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    const noise = ((state >>> 0) / 4294967296) - 0.5
    const contour = 0.27
      + 0.2 * Math.sin(i * 0.16 + seed.length * 0.07)
      + 0.12 * Math.sin(i * 0.047 + 1.8)
      + noise * 0.16
    previous = previous * 0.58 + contour * 0.42
    peaks.push(clamp(previous, 0.08, 0.98))
  }
  return peaks
}

/**
 * Decode an uploaded audio file and reduce it to normalised RMS peaks.
 * Returns null when a browser cannot decode the file; upload/playback can
 * continue with the runtime/fallback waveform in that case.
 */
export async function decodeMusicWaveform(
  file: Blob,
  count = MUSIC_WAVEFORM_PEAK_COUNT,
): Promise<MusicWaveformPeaks | null> {
  if (typeof window === 'undefined') return null

  let context: AudioContext | null = null
  try {
    const AudioContextCtor = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null

    context = new AudioContextCtor()
    const decoded = await context.decodeAudioData(await file.arrayBuffer())
    const frameCount = decoded.length
    if (!frameCount || !decoded.numberOfChannels) return null

    const peaks: number[] = []
    const bucketSize = Math.max(1, Math.floor(frameCount / count))
    let maxPeak = 0

    for (let bucket = 0; bucket < count; bucket += 1) {
      const start = bucket * bucketSize
      const end = Math.min(frameCount, bucket === count - 1 ? frameCount : start + bucketSize)
      if (start >= end) {
        peaks.push(0)
        continue
      }

      let sumSquares = 0
      let samples = 0
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const data = decoded.getChannelData(channel)
        // Sampling every fourth frame keeps this inexpensive for long tracks
        // while still retaining the shape of kicks, vocals and transients.
        for (let frame = start; frame < end; frame += 4) {
          const sample = data[frame] ?? 0
          sumSquares += sample * sample
          samples += 1
        }
      }
      const rms = samples > 0 ? Math.sqrt(sumSquares / samples) : 0
      peaks.push(rms)
      maxPeak = Math.max(maxPeak, rms)
    }

    if (maxPeak <= 0.0001) return peaks.map(() => 0.08)
    return peaks.map(peak => clamp(Math.pow(peak / maxPeak, 0.72), 0.08, 1))
  } catch {
    return null
  } finally {
    try { await context?.close() } catch { /* some Safari versions throw here */ }
  }
}
