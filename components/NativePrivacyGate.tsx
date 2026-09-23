'use client'

import type { ReactNode } from 'react'
import { useNativePlatform } from '@/lib/nativeApp'

/**
 * Keeps optional analytics and tracking integrations out of the native
 * wrapper. The wrapper still uses the web app's required auth/session
 * cookies, but no optional analytics scripts are mounted there.
 */
export default function NativePrivacyGate({ children }: { children: ReactNode }) {
  const platform = useNativePlatform()

  if (platform !== 'web') return null
  return <>{children}</>
}
