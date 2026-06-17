'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { calculateProductBasketTotals, centsFromEur } from '@/lib/checkoutConfig'

export type BasketProductType = 'community' | 'external'

export interface BasketItem {
  id: string
  product_type: BasketProductType
  quantity: number
  listing_id: string | null
  external_product_id: string | null
  title: string
  price_eur: number | null
  price_label: string
  image: string | null
  retailer_name?: string | null
  retailer_url?: string | null
  seller_id?: string | null
}

interface BasketContextValue {
  items: BasketItem[]
  userId: string | null
  loading: boolean
  error: string | null
  communityItems: BasketItem[]
  externalItems: BasketItem[]
  communitySubtotalCents: number
  platformFeeCents: number
  communityTotalCents: number
  itemCount: number
  refresh: () => Promise<void>
  addCommunityItem: (listingId: string, quantity?: number) => Promise<{ ok: boolean; error?: string }>
  addExternalItem: (externalProductId: string, quantity?: number) => Promise<{ ok: boolean; error?: string }>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
}

const BasketContext = createContext<BasketContextValue | null>(null)

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/basket', { cache: 'no-store' })
      const data = await res.json() as { userId?: string | null; items?: BasketItem[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Basket unavailable')
      setUserId(data.userId ?? null)
      setItems(data.items ?? [])
    } catch (err) {
      console.error('[Basket] refresh failed', err)
      setError(err instanceof Error ? err.message : 'Basket unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const upsertItem = useCallback(async (payload: { product_type: BasketProductType; listing_id?: string; external_product_id?: string; quantity: number }) => {
    const res = await fetch('/api/basket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json() as { userId?: string | null; items?: BasketItem[]; error?: string }
    if (!res.ok || data.error) return { ok: false, error: data.error ?? 'Could not update basket.' }
    setUserId(data.userId ?? null)
    setItems(data.items ?? [])
    return { ok: true }
  }, [refresh])

  const addCommunityItem = useCallback((listingId: string, quantity = 1) => upsertItem({ product_type: 'community', listing_id: listingId, quantity }), [upsertItem])
  const addExternalItem = useCallback((externalProductId: string, quantity = 1) => upsertItem({ product_type: 'external', external_product_id: externalProductId, quantity }), [upsertItem])

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const nextQty = Math.max(1, Math.min(99, quantity))
    const res = await fetch('/api/basket', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, quantity: nextQty }),
    })
    const data = await res.json() as { userId?: string | null; items?: BasketItem[]; error?: string }
    if (!res.ok || data.error) throw new Error(data.error ?? 'Could not update quantity')
    setUserId(data.userId ?? null)
    setItems(data.items ?? [])
  }, [])

  const removeItem = useCallback(async (itemId: string) => {
    const res = await fetch(`/api/basket?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE' })
    const data = await res.json() as { userId?: string | null; items?: BasketItem[]; error?: string }
    if (!res.ok || data.error) throw new Error(data.error ?? 'Could not remove item')
    setUserId(data.userId ?? null)
    setItems(data.items ?? [])
  }, [])

  const communityItems = useMemo(() => items.filter(item => item.product_type === 'community'), [items])
  const externalItems = useMemo(() => items.filter(item => item.product_type === 'external'), [items])
  const communitySubtotalCents = useMemo(() => communityItems.reduce((sum, item) => sum + centsFromEur(item.price_eur) * item.quantity, 0), [communityItems])
  const basketTotals = useMemo(() => calculateProductBasketTotals(communitySubtotalCents), [communitySubtotalCents])
  const platformFeeCents = basketTotals.platformFeeCents
  const communityTotalCents = basketTotals.totalCents
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])

  const value: BasketContextValue = {
    items,
    userId,
    loading,
    error,
    communityItems,
    externalItems,
    communitySubtotalCents,
    platformFeeCents,
    communityTotalCents,
    itemCount,
    refresh,
    addCommunityItem,
    addExternalItem,
    updateQuantity,
    removeItem,
  }

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
}

export function useBasket() {
  const ctx = useContext(BasketContext)
  if (!ctx) throw new Error('useBasket must be used within BasketProvider')
  return ctx
}
