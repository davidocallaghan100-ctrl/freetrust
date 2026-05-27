export type TrustTier = {
  tier: number
  minBalance: number
  label: string
  icon: string
  color: string
}

export const TIERS: TrustTier[] = [
  { tier: 1,  minBalance: 0,     label: 'Newcomer',           icon: '🌱', color: '#94a3b8' },
  { tier: 2,  minBalance: 100,   label: 'Active Member',      icon: '⭐', color: '#38bdf8' },
  { tier: 3,  minBalance: 250,   label: 'Contributor',        icon: '🤝', color: '#22c55e' },
  { tier: 4,  minBalance: 500,   label: 'Established Member', icon: '✅', color: '#34d399' },
  { tier: 5,  minBalance: 1000,  label: 'FreeTrust Pro',      icon: '💎', color: '#818cf8' },
  { tier: 6,  minBalance: 2000,  label: 'Community Leader',   icon: '🏆', color: '#a78bfa' },
  { tier: 7,  minBalance: 5000,  label: 'Trust Champion',     icon: '🔥', color: '#f97316' },
  { tier: 8,  minBalance: 7500,  label: 'Impact Leader',      icon: '🌍', color: '#14b8a6' },
  { tier: 9,  minBalance: 10000, label: 'FreeTrust Elite',    icon: '👑', color: '#f59e0b' },
  { tier: 10, minBalance: 25000, label: 'Founding Pillar',    icon: '🏛️', color: '#facc15' },
]

export function getTierForBalance(balance: number): TrustTier {
  const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0

  for (let i = TIERS.length - 1; i >= 0; i -= 1) {
    if (safeBalance >= TIERS[i].minBalance) return TIERS[i]
  }

  return TIERS[0]
}
