'use client'

import { useEffect, useState } from 'react'

export type NativePlatform = 'ios' | 'android' | 'web'

declare global {
  interface Window {
    __FREETRUST_NATIVE_APP__?: boolean
    __FREETRUST_NATIVE_PLATFORM__?: string
  }
}

export function detectNativePlatform(): NativePlatform {
  if (typeof window === 'undefined' || !window.__FREETRUST_NATIVE_APP__) return 'web'
  return window.__FREETRUST_NATIVE_PLATFORM__ === 'ios' ? 'ios' : 'android'
}

/**
 * Returns null for the first render while the native wrapper marker is read.
 * That prevents server-rendered pages from making a native-only decision.
 */
export function useNativePlatform(): NativePlatform | null {
  const [platform, setPlatform] = useState<NativePlatform | null>(null)

  useEffect(() => {
    setPlatform(detectNativePlatform())
  }, [])

  return platform
}
