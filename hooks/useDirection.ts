'use client'

import {useLocale} from 'next-intl'

export function useDirection(): 'rtl' | 'ltr' {
  return useLocale() === 'ar' ? 'rtl' : 'ltr'
}
